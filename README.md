# Mongoose Cross Database Transaction

This helps with cross db transaction rollback when needed and focus on dependent tree behavior, it is advisable to use single children dependent to avoid situation of one of the list of children failure and only few part are rollback.

## Note
Always set up `NODE_ENV` and if you are using db connection with non transaction/session support due to no clusters, set `NODE_ENV` to `local`.

## Example

You can use the repository to view the test case to have clarity on use case but I will provide sample configuration snippet of code here.

I will imagine two operations from different db but does have a reference in the order model but can cross db update, meaning one update in A should affect update B and failure in any to roll back.

We strongly assume each model uses a unique connection as they belong to different DB and model are per each of the database,

Connection passed are of the each model instance uses in the `action` pertaining to where the model in `action` is used, if u have model from different DB, make one the parent action and the other the childrenSession action as dependent and pass it's own db connection.

### Simple Case 1

The `store` here is the progressive result from each `action` function passed to the next `action` in order at which it is run for dependent parent-children relationship.

Here, only single children for parent and `store[0]` is the result of `action`.

```$
      let createdService: Service & any;

      const transactionConfig: SessionConfig = {
        connection: this.serviceConnection,
        action: async (store, session) =>
          await this.serviceModel.create([newData], { session }),
        childrenSessions: [
          {
            connection: this.keyManagerConnection,
            action: async (store, session) => {
              createdService = store[0];

              const keyPayload: CreateNewKeyType = {
                key_type: KeyType.SERVICE,
                entity: 'service',
                entity_id: createdService._id,
                apiCode: serviceCode,
                expiryDate,
                session,
              };
              return await (this.keyManagerModel as any).createNewKey(
                keyPayload,
              );
            },
          },
        ],
      };

      await withTransaction(transactionConfig);
```


### Simple Case 2

The `store` here is the progressive result from each `action` function passed to the next `action` in order at which it is run for dependent parent-children relationship.

Here,  we have two parent which are nested and the `store` result are followed in order of `0,1`.

```$
  const transactionConfig: SessionConfig = {
            connection: this.keyManagerConnection,
            action: async (store, session) => {
              return this.keyManagerModel.findOneAndUpdate(
                { _id: new Types.ObjectId(keyManager._id.toString()) },
                {
                  $set: {
                    updatedBy: tenant._id,
                    status: KeyStatus.REFRESHED,
                  },
                },
                { new: true, lean: true, session },
              );
            },
            childrenSessions: [
              {
                connection: this.keyManagerConnection,
                action: async (store, session) => {
                  return await generateNewKey(
                    this.keyManagerModel,
                    KeyType.TENANT_PRODUCT,
                    'tenant',
                    new Types.ObjectId(tenant._id),
                    expiryDate,
                    'product',
                    new Types.ObjectId(keyManager.product),
                    keyManager.apiCode,
                    session,
                  );
                },
                childrenSessions: [
                  {
                    connection: this.tenantConnection,
                    action: async (store, session) => {
                     this.tenantModel.updateOne({
                      _id: store[0].tenant,
                      type: store[1].manager.type,
                     }, {name: 'A', data: {sample: 1}})
                     
                  },
                ],
              },
            ],
          };
         
         await withTransaction(transactionConfig);

```

### Sample case 3
This type is demonstrated in the repo where we have more than one childrenSession within a single parent rather than nested children

```$
  {
   connection,
   action,
    childrenSessions: [
       {connection, action},
      
       {connection, action},
    ]
  }
```

The case above does means the parent action can be rollback where one child executing independently failed but case like this might exists where both children are independent but we advise using the dependent approach.
