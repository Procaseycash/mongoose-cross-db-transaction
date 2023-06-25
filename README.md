# Mongoose Cross Database Transaction

The **Mongoose Cross Database Transaction** library facilitates cross-database transaction rollback and focuses on dependent tree behavior. It is recommended to use a single children dependency to avoid situations where the failure of one child affects only a portion of the operation, leading to potential inconsistencies.

## Note
- It is important to set the NODE_ENV environment variable before using the mongoose-cross-db-transaction library. NODE_ENV specifies the execution environment of your application and affects how the library behaves.

- If you are using a database connection that does not support transactions or sessions (particularly when there are no clusters involved), it is recommended to set NODE_ENV to local. This ensures that the library adapts its transaction handling accordingly to work effectively in such scenarios.

- When NODE_ENV is set to local, it's important to note that the queries executed by the library will not provide full ACID (Atomicity, Consistency, Isolation, Durability) properties. This is due to the limitations of the underlying database connection. Therefore, ensure that your application's requirements align with the capabilities provided when using NODE_ENV as local.

## Documentation

## Installation
To install the `mongoose-cross-db-transaction` library, follow these steps:

- Ensure you have Node.js and npm (Node Package Manager) installed on your machine.
- Open your terminal or command prompt.
- Navigate to your project directory.
- Run the following command to install the library:
```sh
$ npm install mongoose-cross-db-transaction
```
- Once the installation is complete, you can import the library into your project using the following line of code:
```ts
  const { withTransaction } = require('mongoose-cross-db-transaction');
```
If you are using ES modules or TypeScript, you can import the library as follows:
```ts
  import { withTransaction } from 'mongoose-cross-db-transaction';
```
- You are now ready to use the mongoose-cross-db-transaction library in your project for managing cross-database transactions.
## Example

To gain a clear understanding of the `mongoose-cross-db-transaction` library's functionality, it is recommended to refer to the test cases available in the repository. These test cases provide comprehensive examples that showcase the library's capabilities. Additionally, here is a sample code snippet that illustrates the configuration:

Consider a scenario where you have two operations originating from different databases, but they are interconnected through a reference in the Order model. These operations enable cross-database updates, meaning that a change made in Database A should reflect in Database B. In the event of a failure, the operations should be rolled back to maintain data consistency.

It is important to note that each model should use a unique `connection` as they belong to different databases. Assign the appropriate model instance's connection to the action associated with that model. If you have models from different databases, designate one as the **parent action** and the other as the **childrenSession action** to establish the dependent relationship. Make sure to pass the respective **database connections** to the corresponding actions.

By following these guidelines and studying the provided examples, you will be able to effectively configure and utilize the mongoose-cross-db-transaction library for handling cross-database transactions.

### Simple Case 1

In this example, we have a parent action and a single children session. The `store` variable represents the progressive result passed from one `action` to another in the specified order. The `action` function is where you define the logic for each operation within the transaction. The provided code showcases the creation of a new service and the generation of a new key using the `serviceModel` and `keyManagerModel`.

Here, only single children for parent and `store[0]` is the result of `action`.

```ts
      import { withTransaction, SessionConfig } from 'mongoose-cross-db-transaction';

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
This example demonstrates a more complex scenario with nested actions. The `transactionConfig` object contains the parent action and two levels of children sessions. The code shows the update of a key manager, the generation of a new key, and the update of a tenant record. Each action is defined within its respective `action` function. The `store` variable allows you to access the results from previous actions.

The `store` here is the progressive result from each `action` function passed to the next `action` in order at which it is run for dependent parent-children relationship.

Here,  we have two parent which are nested and the `store` result are followed in order of `0,1`.

```ts
  import { withTransaction, SessionConfig } from 'mongoose-cross-db-transaction';

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
                     }, {name: 'A', data: {sample: 1}}, {session})
                     
                  },
                ],
              },
            ],
          };
         
         await withTransaction(transactionConfig);

```

### Sample case 3
This case showcases multiple children sessions at the same level, without nesting. Each `childrenSessions` array contains independent actions. The parent action is followed by two children sessions, each with its own connection and action functions. This setup allows for parallel execution of the children actions. However, it's important to note that if one of the children sessions fails, the parent action will still be rolled back.

```ts
  {
   connection,
   action,
    childrenSessions: [
       {connection, action},
      
       {connection, action},
    ]
  }
```

** The case above does means the parent action can be rollback where one child executing independently failed but case like this might exists where both children are independent but we advise using the dependent approach.
