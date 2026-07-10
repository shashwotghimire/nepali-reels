import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.PGHOST!,
  database: process.env.PGDATABASE!,
  username: process.env.PGUSER!,
  password: process.env.PGPASSWORD!,
  dialectOptions: {
    ssl: {
      require: true,
    },
  },
  logging: false,
});

export default sequelize;

export async function authenticateDB() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
}
