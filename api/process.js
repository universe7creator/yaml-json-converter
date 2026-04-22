export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input, mode, demo } = req.body;
  const licenseKey = req.headers['x-license-key'];

  if (!input) {
    return res.status(400).json({ error: 'Input is required' });
  }

  // Demo mode - limited functionality
  const isDemo = demo === true;
  const validLicense = licenseKey && licenseKey.startsWith('YJC-');

  try {
    let output;
    let error = null;

    if (mode === 'yaml-to-json' || mode === 'yaml2json') {
      // Simple YAML to JSON parser
      output = parseYAML(input);
    } else if (mode === 'json-to-yaml' || mode === 'json2yaml') {
      // JSON to YAML converter
      const jsonObj = JSON.parse(input);
      output = convertToYAML(jsonObj);
    } else {
      return res.status(400).json({ error: 'Invalid mode. Use yaml-to-json or json-to-yaml' });
    }

    if (isDemo || validLicense) {
      return res.status(200).json({
        input: input.substring(0, 500),
        output,
        mode,
        success: !error,
        error,
        ...(validLicense && { license: 'valid', remaining: 9999 })
      });
    }

    return res.status(401).json({
      error: 'Valid license key required',
      checkout_url: process.env.CHECKOUT_URL || null
    });

  } catch (err) {
    return res.status(400).json({ error: 'Parse error: ' + err.message });
  }
};

// Simple YAML parser
function parseYAML(yaml) {
  const lines = yaml.split('\n');
  const result = {};
  let current = result;
  const stack = [];
  let indentLevel = 0;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    if (content.includes(':')) {
      const [key, ...valueParts] = content.split(':');
      const value = valueParts.join(':').trim();

      if (value) {
        current[key.trim()] = parseValue(value);
      } else {
        current[key.trim()] = {};
        stack.push({ obj: current, key: key.trim(), indent: indent });
        current = current[key.trim()];
      }
    }
  }

  return JSON.stringify(result, null, 2);
}

function parseValue(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
  if (val.startsWith('[') && val.endsWith(']')) {
    return val.slice(1, -1).split(',').map(v => parseValue(v.trim()));
  }
  return val.replace(/^["']|["']$/g, '');
}

// JSON to YAML converter
function convertToYAML(obj, indent = 0) {
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj.toString();
  if (typeof obj === 'number') return obj.toString();
  if (typeof obj === 'string') return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => '  '.repeat(indent) + '- ' + convertToYAML(item, indent + 1)).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const valueStr = convertToYAML(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return '  '.repeat(indent) + key + ':\n' + valueStr;
      }
      return '  '.repeat(indent) + key + ': ' + valueStr;
    }).join('\n');
  }
  return String(obj);
}
