import { sequelize } from "./src/infrastructure/database/sequelize.hml";

export default async function globalTeardown() {
  await sequelize.close();
}
