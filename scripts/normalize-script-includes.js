#!/usr/bin/env node

/**
 * Normalize ServiceNow Script Includes from CI/CD update XML
 *
 * Usage:
 *   node normalize-script-includes.js <sourceDir> <targetAppDir>
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const [,, sourceDir, targetAppDir] = process.argv;

if (!sourceDir || !targetAppDir) {
  console.error('Usage: node normalize-script-includes.js <sourceDir> <targetAppDir>');
  process.exit(1);
}

const UPDATE_DIR = path.join(sourceDir, 'update');
const OUTPUT_DIR = path.join(targetAppDir, 'script_includes');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const parser = new xml2js.Parser({ explicitArray: true });

/**
 * Extract Script Include record from different XML shapes
 */
function extractScriptInclude(xml) {
  // CI/CD update XML
  if (xml.record_update?.sys_script_include) {
    return xml.record_update.sys_script_include[0];
  }

  // Direct table export (fallback)
  if (xml.sys_script_include) {
    return xml.sys_script_include[0];
  }

  return null;
}

/**
 * Normalize a single XML file
 */
async function processFile(filePath) {
  const xmlContent = fs.readFileSync(filePath, 'utf8');

  const parsed = await parser.parseStringPromise(xmlContent);
  const record = extractScriptInclude(parsed);

  if (!record) return;

  const name = record.name?.[0];
  const script = record.script?.[0];
  const apiName = record.api_name?.[0] || '';
  const active = record.active?.[0] || 'true';

  if (!name || !script) return;

  const outputFile = path.join(OUTPUT_DIR, `${name}.js`);

  const header = `/**
 * App: ${path.basename(targetAppDir)}
 * Type: Script Include
 * Name: ${name}
 * API Name: ${apiName}
 * Active: ${active}
 * Source: ${path.basename(filePath)}
 */
`;

  fs.writeFileSync(outputFile, header + '\n' + script.trim() + '\n');
}

/**
 * Main
 */
(async function main() {
  if (!fs.existsSync(UPDATE_DIR)) {
    console.error(`Update directory not found: ${UPDATE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(UPDATE_DIR)
    .filter(f => f.startsWith('sys_script_include_') && f.endsWith('.xml'));

  for (const file of files) {
    await processFile(path.join(UPDATE_DIR, file));
  }

  console.log('Script Include normalization complete');
})();
