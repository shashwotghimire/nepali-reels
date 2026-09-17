require("dotenv/config");

module.exports = {
  development: {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    dialect: "postgres",
    dialectOptions: {
      ssl: process.env.PGSSL === "disable" ? false : { require: true },
    },
  },
};
