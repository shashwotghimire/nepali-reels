"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("tiktok_connection", "displayName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("tiktok_connection", "avatarUrl", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("tiktok_connection", "username", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("tiktok_connection", "displayName");
    await queryInterface.removeColumn("tiktok_connection", "avatarUrl");
    await queryInterface.removeColumn("tiktok_connection", "username");
  },
};
