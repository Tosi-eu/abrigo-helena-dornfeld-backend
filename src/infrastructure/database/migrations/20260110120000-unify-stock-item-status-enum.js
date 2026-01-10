'use strict';

/**
 * Migration to unify stock item status as ENUM type
 * Converts estoque_medicamento.status from STRING to ENUM
 * to match estoque_insumo.status which already uses ENUM
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the shared ENUM type for stock item status
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        -- Create the ENUM type if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_item_status') THEN
          CREATE TYPE stock_item_status AS ENUM ('active', 'suspended');
        END IF;
      END $$;
    `);

    // Check if estoque_medicamento table exists and has status column
    const [medicineTableCheck] = await queryInterface.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'estoque_medicamento'
    `);

    if (medicineTableCheck.length > 0) {
      // Table exists, check column type
      const [medicineColumnInfo] = await queryInterface.sequelize.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'estoque_medicamento' 
        AND column_name = 'status'
        AND table_schema = 'public'
      `);

      if (medicineColumnInfo.length > 0) {
        const columnType = medicineColumnInfo[0].data_type;
        const udtName = medicineColumnInfo[0].udt_name;

        // If it's VARCHAR/STRING (not already ENUM), convert it
        if (columnType === 'character varying' || columnType === 'text') {
          // Ensure all values are valid before conversion
          await queryInterface.sequelize.query(`
            UPDATE estoque_medicamento 
            SET status = 'active' 
            WHERE status IS NULL OR status NOT IN ('active', 'suspended');
          `);

          // Convert the column type to ENUM
          await queryInterface.sequelize.query(`
            ALTER TABLE estoque_medicamento
            ALTER COLUMN status
            TYPE stock_item_status
            USING status::text::stock_item_status;
          `);
        } else if (udtName && udtName !== 'stock_item_status') {
          // It's already an ENUM but different type, convert it
          await queryInterface.sequelize.query(`
            ALTER TABLE estoque_medicamento
            ALTER COLUMN status
            TYPE stock_item_status
            USING status::text::stock_item_status;
          `);
        }
        // If already using stock_item_status, do nothing
      }
    }

    // Check if estoque_insumo table exists and has status column
    const [inputTableCheck] = await queryInterface.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'estoque_insumo'
    `);

    if (inputTableCheck.length > 0) {
      // Table exists, check and convert if needed
      const [inputColumnInfo] = await queryInterface.sequelize.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'estoque_insumo' 
        AND column_name = 'status'
        AND table_schema = 'public'
      `);

      if (inputColumnInfo.length > 0) {
        const udtName = inputColumnInfo[0].udt_name;

        // If it's using a different enum type, convert it to the shared one
        if (udtName && udtName !== 'stock_item_status') {
          // Convert to stock_item_status enum
          await queryInterface.sequelize.query(`
            ALTER TABLE estoque_insumo
            ALTER COLUMN status
            TYPE stock_item_status
            USING status::text::stock_item_status;
          `);

          // Try to drop the old enum type (if not used elsewhere)
          // Safely escape the enum name to prevent SQL injection
          const safeTypeName = udtName.replace(/[^a-zA-Z0-9_]/g, '');
          await queryInterface.sequelize.query(`
            DO $$
            DECLARE
              old_type_name text := '${safeTypeName}';
            BEGIN
              -- Try to drop the old enum type
              BEGIN
                EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', old_type_name);
              EXCEPTION
                WHEN OTHERS THEN
                  -- Ignore errors if type is still in use or doesn't exist
                  NULL;
              END;
            END $$;
          `);
        }
      }
    }
    // If tables don't exist yet, sequelize.sync will create them with correct ENUM type from models
  },

  async down(queryInterface, Sequelize) {
    // Revert estoque_medicamento.status back to STRING
    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_medicamento
      ALTER COLUMN status
      TYPE VARCHAR(20)
      USING status::text;
    `);

    // Revert estoque_insumo.status back to a separate ENUM if needed
    // For rollback, we'll just keep using the shared enum or recreate a separate one
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- Create a separate enum for insumo if rolling back
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'input_stock_status') THEN
          CREATE TYPE input_stock_status AS ENUM ('active', 'suspended');
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE estoque_insumo
      ALTER COLUMN status
      TYPE input_stock_status
      USING status::text::input_stock_status;
    `);

    // Note: We don't drop stock_item_status enum as it might be used elsewhere
  },
};

