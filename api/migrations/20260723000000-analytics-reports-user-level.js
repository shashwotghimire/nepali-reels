'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('analytics_reports');
    await queryInterface.createTable('analytics_reports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.TEXT, allowNull: false, references: { model: 'user', key: 'id' }, onDelete: 'CASCADE' },
      rawData: { type: Sequelize.JSONB, allowNull: false },
      report: { type: Sequelize.JSONB, allowNull: true },
      suggestions: { type: Sequelize.JSONB, allowNull: true },
      fetchedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('analytics_reports', ['userId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('analytics_reports');
    // Recreate old schema omitted — irreversible data change
  },
};
