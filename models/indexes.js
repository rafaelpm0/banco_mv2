import { conectarMongoDB, closeMongoDb } from '../DBs/mongoDB/mongoDB.js';

async function createIndexes() {
  let client;
  try {
    const { db, client: mongoClient } = await conectarMongoDB();
    client = mongoClient;
    const collection = db.collection('employees');

    // Index for findEmployeesByManagerDepartment
    // For manager lookup by emp_no
    await collection.createIndex({ "manager_info.manager_emp_no": 1 });
    // For manager lookup by full name
    await collection.createIndex({ 
      first_name: 1,
      last_name: 1
    });
    // For department searches with date overlap
    await collection.createIndex({ 
      "departments.dept_name": 1,
      "departments.from_date": 1,
      "departments.to_date": 1 
    });

    // Index for findEmployeesByTitle
    await collection.createIndex({ "titles.title": 1 });

    // Index for findEmployeesByDepartment
    await collection.createIndex({ "departments.dept_name": 1 });

    // Index for listAvgSalaryByDepartment
    await collection.createIndex({ 
      "departments.dept_name": 1,
      "salaries.from_date": 1,
      "salaries.to_date": 1 
    });

    console.log("Indexes created successfully");
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    if (client) await closeMongoDb(client);
  }
}

createIndexes()