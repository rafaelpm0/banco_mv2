import { Sequelize, DataTypes } from 'sequelize';
import { connectToDatabase, closeDatabaseConnection } from '../DBs/mySql/mqSql.js';



export async function fetchAllEmployees(){
  try{
    const sequelize = connectToDatabase();
    const [results] = await sequelize.query('SELECT * FROM employees');
    console.log('Resultados:', results);
    //console.log('Metadata:', metadata);
    closeDatabaseConnection(sequelize);
    return results;

  }
  catch (error) {
    throw new Error(`Erro ao buscar todos os funcionários: ${error.message}`);
  }
}

fetchAllEmployees()
