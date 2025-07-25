#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * Получение схемы базы данных
 */
async function getDatabaseSchema(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const schema = {};
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      if (tables.length === 0) {
        db.close();
        return resolve(schema);
      }
      
      let completed = 0;
      
      tables.forEach(table => {
        const tableName = table.name;
        
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
          if (err) {
            db.close();
            return reject(err);
          }
          
          schema[tableName] = {};
          columns.forEach(col => {
            schema[tableName][col.name] = col.type;
          });
          
          completed++;
          if (completed === tables.length) {
            db.close();
            resolve(schema);
          }
        });
      });
    });
  });
}

/**
 * Сравнение схем БД
 */
async function compareSchemas() {
  try {
    console.log('🔍 СРАВНЕНИЕ СХЕМ БД');
    console.log('====================\n');
    
    const prodDb = '/home/enclude/automation/production/delivery.db';
    const devDb = '/home/enclude/automation/development/delivery-dev.db';
    
    // Проверяем существование файлов
    if (!fs.existsSync(prodDb)) {
      throw new Error(`Production БД не найдена: ${prodDb}`);
    }
    if (!fs.existsSync(devDb)) {
      throw new Error(`Development БД не найдена: ${devDb}`);
    }
    
    console.log('📊 Получение схем...');
    const prodSchema = await getDatabaseSchema(prodDb);
    const devSchema = await getDatabaseSchema(devDb);
    
    console.log(`✅ Production: ${Object.keys(prodSchema).length} таблиц`);
    console.log(`✅ Development: ${Object.keys(devSchema).length} таблиц\n`);
    
    // Сравниваем схемы
    const differences = {
      tables: {
        added: [],
        removed: [],
        modified: []
      },
      columns: {
        added: [],
        removed: [],
        modified: []
      }
    };
    
    // Сравниваем таблицы
    const prodTables = Object.keys(prodSchema);
    const devTables = Object.keys(devSchema);
    
    // Находим добавленные таблицы
    differences.tables.added = devTables.filter(table => !prodTables.includes(table));
    
    // Находим удаленные таблицы
    differences.tables.removed = prodTables.filter(table => !devTables.includes(table));
    
    // Сравниваем общие таблицы
    const commonTables = prodTables.filter(table => devTables.includes(table));
    
    console.log('🔍 Сравнение таблиц...');
    for (const table of commonTables) {
      const prodColumns = prodSchema[table];
      const devColumns = devSchema[table];
      
      // Сравниваем колонки
      const prodColumnNames = Object.keys(prodColumns);
      const devColumnNames = Object.keys(devColumns);
      
      // Находим добавленные колонки
      const addedColumns = devColumnNames.filter(col => !prodColumnNames.includes(col));
      if (addedColumns.length > 0) {
        differences.columns.added.push({
          table,
          columns: addedColumns
        });
        console.log(`➕ Таблица "${table}": добавлены колонки ${addedColumns.join(', ')}`);
      }
      
      // Находим удаленные колонки
      const removedColumns = prodColumnNames.filter(col => !devColumnNames.includes(col));
      if (removedColumns.length > 0) {
        differences.columns.removed.push({
          table,
          columns: removedColumns
        });
        console.log(`➖ Таблица "${table}": удалены колонки ${removedColumns.join(', ')}`);
      }
      
      // Сравниваем общие колонки
      const commonColumns = prodColumnNames.filter(col => devColumnNames.includes(col));
      for (const col of commonColumns) {
        if (prodColumns[col] !== devColumns[col]) {
          differences.columns.modified.push({
            table,
            column: col,
            production: prodColumns[col],
            development: devColumns[col]
          });
          console.log(`🔄 Таблица "${table}": изменен тип колонки "${col}" (prod: ${prodColumns[col]} → dev: ${devColumns[col]})`);
        }
      }
    }
    
    // Выводим результаты
    console.log('\n📋 РЕЗУЛЬТАТЫ СРАВНЕНИЯ:');
    console.log('========================');
    
    if (differences.tables.added.length > 0) {
      console.log('\n🆕 НОВЫЕ ТАБЛИЦЫ:');
      differences.tables.added.forEach(table => {
        console.log(`  • ${table}`);
      });
    }
    
    if (differences.tables.removed.length > 0) {
      console.log('\n🗑️ УДАЛЕННЫЕ ТАБЛИЦЫ:');
      differences.tables.removed.forEach(table => {
        console.log(`  • ${table}`);
      });
    }
    
    if (differences.columns.added.length > 0) {
      console.log('\n➕ НОВЫЕ КОЛОНКИ:');
      differences.columns.added.forEach(item => {
        console.log(`  • Таблица "${item.table}": ${item.columns.join(', ')}`);
      });
    }
    
    if (differences.columns.removed.length > 0) {
      console.log('\n➖ УДАЛЕННЫЕ КОЛОНКИ:');
      differences.columns.removed.forEach(item => {
        console.log(`  • Таблица "${item.table}": ${item.columns.join(', ')}`);
      });
    }
    
    if (differences.columns.modified.length > 0) {
      console.log('\n🔄 ИЗМЕНЕННЫЕ КОЛОНКИ:');
      differences.columns.modified.forEach(item => {
        console.log(`  • Таблица "${item.table}": ${item.column} (prod: ${item.production} → dev: ${item.development})`);
      });
    }
    
    const hasDifferences = differences.tables.added.length > 0 || 
                          differences.tables.removed.length > 0 || 
                          differences.columns.added.length > 0 || 
                          differences.columns.removed.length > 0 || 
                          differences.columns.modified.length > 0;
    
    console.log('\n🎯 ИТОГ:');
    if (hasDifferences) {
      console.log('❌ СХЕМЫ БД РАЗЛИЧАЮТСЯ');
    } else {
      console.log('✅ СХЕМЫ БД ИДЕНТИЧНЫ');
    }
    
    // Детальный вывод схем для отладки
    console.log('\n🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ТАБЛИЦЫ USERS:');
    console.log('====================================');
    
    if (prodSchema.users && devSchema.users) {
      console.log('\n📊 PRODUCTION users:');
      Object.entries(prodSchema.users).forEach(([col, type]) => {
        console.log(`  • ${col}: ${type}`);
      });
      
      console.log('\n📊 DEVELOPMENT users:');
      Object.entries(devSchema.users).forEach(([col, type]) => {
        console.log(`  • ${col}: ${type}`);
      });
    } else {
      console.log('❌ Таблица users не найдена в одной из БД');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск
compareSchemas(); 