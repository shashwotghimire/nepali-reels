import { Sequelize } from "sequelize";

const sequelize = process.env.PHASE4_TEST_DATABASE_URL
  ? new Sequelize(process.env.PHASE4_TEST_DATABASE_URL, { dialect: "postgres", logging: false })
  : new Sequelize({
  dialect: "postgres",
  host: process.env.PGHOST!,
  database: process.env.PGDATABASE!,
  username: process.env.PGUSER!,
  password: process.env.PGPASSWORD!,
  dialectOptions: {
    ssl: process.env.PGSSL === "disable" ? false : { require: true },
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
