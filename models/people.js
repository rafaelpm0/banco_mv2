import { Sequelize, DataTypes } from 'sequelize';
import { connectToDatabase } from '../mySql/mqSql.js';

const sequelize = connectToDatabase();

const People = sequelize.define('People', {
  Index: { type: DataTypes.INTEGER, primaryKey: true },
  User_Id: { type: DataTypes.STRING, allowNull: false },
  First_Name: { type: DataTypes.STRING, allowNull: false },
  Last_Name: { type: DataTypes.STRING, allowNull: false },
  Sex: { type: DataTypes.STRING },
  Email: { type: DataTypes.STRING },
  Phone: { type: DataTypes.STRING },
  Date_of_birth: { type: DataTypes.DATE },
  Job_Title: { type: DataTypes.STRING },
}, {
  tableName: 'people',
  timestamps: false,
});

export default People;