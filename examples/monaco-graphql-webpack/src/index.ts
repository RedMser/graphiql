/* global netlify */

import * as JSONC from 'jsonc-parser';

import { createEditors } from './editors';
import { schemaFetcher, schemaOptions } from './schema';
import './style.css';

const SITE_ID = '46a6b3c8-992f-4623-9a76-f1bd5d40505c';

void render();

async function render() {
  document.getElementById('github-login-wrapper')?.remove();
  document
    .getElementById('session-editor')
    ?.setAttribute('style', 'display: flex');
  document
    .getElementById('toolbar')
    ?.setAttribute('style', 'display: inline-flex');

  const toolbar = document.getElementById('toolbar')!;
  const editors = createEditors();
  const {
    operationModel,
    operationEditor,
    variablesEditor,
    schemaEditor,
    resultsEditor,
    variablesModel,
    schemaModel,
  } = editors;
  const { schemaReloadButton, executeOpButton, schemaPicker } =
    renderToolbar(toolbar);

  const operationUri = operationModel.uri.toString();

  const schema = await schemaFetcher.loadSchema();
  if (schema) {
    console.log('loaded schema', schema);

    schemaEditor.setValue(schema.documentString || '');
  }

  operationModel.onDidChangeContent(() => {
    setTimeout(() => {
      localStorage.setItem('operations', operationModel.getValue());
    }, 200);
  });
  variablesModel.onDidChangeContent(() => {
    setTimeout(() => {
      localStorage.setItem('variables', variablesModel.getValue());
    }, 200);
  });
  schemaModel.onDidChangeContent(() => {
    setTimeout(async () => {
      const value = schemaModel.getValue();
      localStorage.setItem('schema-sdl', value);

      const nextSchema = await schemaFetcher.overrideSchema(value);
    }, 200);
  });

  /**
   * Choosing a new schema
   */
  schemaPicker.addEventListener(
    'input',
    async function SchemaSelectionHandler(_ev: Event) {
      if (schemaPicker.value === schemaFetcher.currentSchema.value) {
        return;
      }

      const schemaResult = await schemaFetcher.changeSchema(schemaPicker.value);
      if (schemaResult) {
        schemaEditor.setValue(schemaResult.documentString || '');
      }
    },
  );

  /**
   * Reloading your schema
   */
  schemaReloadButton.addEventListener('click', async () => {
    const schemaResult = await schemaFetcher.loadSchema();
    if (schemaResult) {
      schemaEditor.setValue(schemaResult.documentString || '');
    }
  });

  /**
   * Execute GraphQL operations, for reference!
   * monaco-graphql itself doesn't do anything with handling operations yet, but it may soon!
   */

  const getOperationHandler = () => async () => {
    try {
      const operation = operationEditor.getValue();
      const variables = variablesEditor.getValue();
      const body: { variables?: string; query: string } = {
        query: operation,
      };
      // parse the variables with JSONC, so we can have comments!
      const parsedVariables = JSONC.parse(variables);
      if (parsedVariables && Object.keys(parsedVariables).length) {
        body.variables = JSON.stringify(parsedVariables, null, 2);
      }
      const result = await fetch(schemaFetcher.currentSchema.value, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...schemaFetcher.currentSchema?.headers,
        },
        body: JSON.stringify(body, null, 2),
      });

      const resultText = await result.text();
      resultsEditor.setValue(JSON.stringify(JSON.parse(resultText), null, 2));
    } catch (err) {
      if (err instanceof Error) {
        resultsEditor.setValue(err.toString());
      }
    }
  };

  const operationHandler = getOperationHandler();

  executeOpButton.addEventListener('click', operationHandler);
  executeOpButton.addEventListener('touchend', operationHandler);
}

function renderToolbar(toolbar: HTMLElement) {
  toolbar.innerHTML = '';

  const schemaStatus = document.createElement('div');
  const schemaReloadButton = document.createElement('button');
  const executeOpButton = document.createElement('button');
  const schemaPicker = getSchemaPicker();
  const executionTray = document.createElement('div');

  executionTray.id = 'execution-tray';
  executionTray.append(executeOpButton);
  executionTray.classList.add('align-right');

  executeOpButton.id = 'execute-op';
  executeOpButton.textContent = 'Run Operation ➤';
  executeOpButton.title = 'Execute the active GraphQL Operation';

  schemaReloadButton.classList.add('reload-button');
  schemaReloadButton.innerHTML = '🔄';
  schemaReloadButton.title = 'Reload the graphql schema';

  schemaStatus.id = 'schema-status';
  schemaStatus.innerHTML = 'Schema Empty';

  toolbar.append(
    schemaPicker,
    schemaReloadButton,
    schemaStatus,
    executeOpButton,
  );
  return { schemaReloadButton, executeOpButton, schemaStatus, schemaPicker };
}

function getSchemaPicker(): HTMLSelectElement {
  const schemaPicker = document.createElement('select');
  schemaPicker.id = 'schema-picker';

  for (const option of schemaOptions) {
    const optEl = document.createElement('option');
    optEl.value = option.value;
    optEl.label = option.label;
    if (option.default) {
      optEl.selected = true;
    }
    schemaPicker.append(optEl);
  }

  return schemaPicker;
}
