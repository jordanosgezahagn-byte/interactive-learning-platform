import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let pyodidePromise;
let phpPromise;

function withNetworkDisabled(run) {
  const apiNames = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport'];
  const originalDescriptors = new Map(apiNames.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]));
  globalThis.fetch = () => Promise.reject(new Error('Network requests are disabled in the code sandbox.'));
  for (const name of apiNames.slice(1)) {
    const descriptor = originalDescriptors.get(name);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(globalThis, name, {
        value: undefined,
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
      });
    } else if (descriptor?.writable) {
      globalThis[name] = undefined;
    }
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    });
}

async function runPython(code) {
  pyodidePromise ??= import('pyodide').then(({ loadPyodide }) => loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/npm/pyodide@314.0.7/',
  }));
  const pyodide = await pyodidePromise;
  const output = [];
  pyodide.setStdout({ batched: (text) => output.push(text) });
  pyodide.setStderr({ batched: (text) => output.push(text) });
  let needsInput = true;
  pyodide.setStdin({ stdin: () => {
    if (!needsInput) return null;
    needsInput = false;
    return 'Learner\n';
  } });

  const result = await withNetworkDisabled(() => pyodide.runPythonAsync(code));
  if (result !== undefined) {
    if (String(result) !== 'None') output.push(String(result));
    if (typeof result.destroy === 'function') result.destroy();
  }
  return output.join('\n').trimEnd();
}

async function runPhp(code) {
  phpPromise ??= Promise.all([
    import('@php-wasm/universal'),
    import('@php-wasm/php-8-4-asyncify'),
  ]).then(async ([{ PHP, loadPHPRuntime }, phpLoaderModule]) => {
    const runtimeId = await loadPHPRuntime(phpLoaderModule);
    return new PHP(runtimeId);
  });
  const php = await phpPromise;
  php.mkdirTree('/workspace');
  const scriptPath = '/workspace/lesson.php';
  php.writeFile(scriptPath, code);
  const response = await withNetworkDisabled(() => php.runStream({ scriptPath }));
  const [stdout, stderr, exitCode] = await Promise.all([
    response.stdoutText,
    response.stderrText,
    response.exitCode,
  ]);
  const output = [stdout, stderr].filter(Boolean).join('\n').trimEnd();
  if (exitCode !== 0) throw new Error(output || `PHP exited with code ${exitCode}.`);
  return output;
}

function seedReferencedTables(database, code) {
  const tables = {
    courses: {
      columns: 'id INTEGER PRIMARY KEY, title TEXT, difficulty TEXT, instructor_id INTEGER',
      rows: [[1, 'HTML & CSS', 'beginner', 1], [2, 'JavaScript', 'beginner', 1], [3, 'Python', 'beginner', 2]],
    },
    users: {
      columns: 'id INTEGER PRIMARY KEY, full_name TEXT',
      rows: [[1, 'Avery Learner'], [2, 'Jordan Instructor']],
    },
    enrollments: {
      columns: 'student_id INTEGER, course_id INTEGER, PRIMARY KEY (student_id, course_id)',
      rows: [[1, 1], [1, 2]],
    },
    accounts: {
      columns: 'id INTEGER PRIMARY KEY, balance REAL',
      rows: [[1, 100]],
    },
  };

  for (const [table, { columns, rows }] of Object.entries(tables)) {
    const tableName = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isReferenced = new RegExp(`\\b${tableName}\\b`, 'i').test(code);
    const isCreatedByCode = new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:\\x60${tableName}\\x60|${tableName})\\b`, 'i').test(code);
    if (!isReferenced || isCreatedByCode) continue;

    database.run(`CREATE TABLE ${table} (${columns})`);
    const placeholders = rows[0].map(() => '?').join(', ');
    const insert = database.prepare(`INSERT INTO ${table} VALUES (${placeholders})`);
    for (const row of rows) insert.run(row);
    insert.free();
  }
}

async function runMysql(code) {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const database = new SQL.Database();
  try {
    database.run('PRAGMA foreign_keys = ON');
    seedReferencedTables(database, code);
    const compatibleCode = code
      .replace(/\bSTART\s+TRANSACTION\b/gi, 'BEGIN')
      .replace(/\bAUTO_INCREMENT\b/gi, 'AUTOINCREMENT')
      .replace(/\bUNSIGNED\b/gi, '')
      .replace(/\bINT\b/gi, 'INTEGER')
      .replace(/\bVARCHAR\s*\(\s*\d+\s*\)/gi, 'TEXT')
      .replace(/\bENGINE\s*=\s*\w+/gi, '');
    const results = database.exec(compatibleCode);
    const output = results.map(({ columns, values }) => (
      [columns.join('\t'), ...values.map((row) => row.map((value) => value === null ? 'NULL' : String(value)).join('\t'))].join('\n')
    ));
    if (output.length) return output.join('\n\n');
    const changedRows = database.getRowsModified();
    return changedRows
      ? `Statement ran successfully. Rows changed: ${changedRows}.`
      : 'Statement ran successfully. It does not return rows; use SELECT to view data.';
  } finally {
    database.close();
  }
}

self.onmessage = async ({ data }) => {
  const { requestId, language, code } = data;
  try {
    const output = await ({
      python: runPython,
      php: runPhp,
      mysql: runMysql,
    })[language](code);
    self.postMessage({ requestId, output });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
  }
};
