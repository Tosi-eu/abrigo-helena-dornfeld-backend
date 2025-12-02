import express from "express";
import dotenv from "dotenv";
import routes from "./routes/index.routes";
import { sequelize } from "../database/sequelize";
import { setupAssociations } from "../database/models/associations.models";
import { seedCabinetCategories } from "../database/seed/cabinet-categories.seed";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use("/api", routes);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✓ Conexão com o banco estabelecida.");

    setupAssociations();

    await sequelize.sync({ alter: false });
    console.log("✓ Tabelas sincronizadas.");

    await seedCabinetCategories();

    app.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
    });
  } catch (err) {
    console.error("Erro ao iniciar:", err);
  }
})();
