import './python-runner.scss';
import template from './python-runner.html';

import {CodeEditorInstance} from '../../../code-editor';
import {createNgModel, initNgScope, inject} from '../../../core';
import createRunner, {Runner} from '../../services/runner-service';
import {attachErrorHandler} from '../../services/syntax-valdator/syntax-validator-service';
import {initPythonWorker} from '../../services/workers/python-parser-worker';
import {RunnerComponentInstance} from '../runner/runner';
import initPythonRunner from './python-runner-init';

function initEditorComponentInstance(scope, editorComponentInstance: CodeEditorInstance, runnerComponentDeferred) {
  runnerComponentDeferred.then((runnerComponentInstance: RunnerComponentInstance) => {
    editorComponentInstance.addShortcut('Ctrl-Enter', 'Command-Enter', () => runnerComponentInstance.run(), scope);
    editorComponentInstance.getSelection()
      .on('select', text => {
        scope.vm.selection = text;
        scope.vm.runnerOptions.buttonText = 'Run selection';
      })
      .on('deselect', () => {
        scope.vm.selection = null;
        scope.vm.runnerOptions.buttonText = null;
      });

    runnerComponentInstance.on('error', (rowNumber, msg) => editorComponentInstance.getAnnotator().showError(rowNumber, msg));

    if (editorComponentInstance.getParams().hasParams()) {
      const code = editorComponentInstance.getParams().formatEmbed({runCustom: true});

      createRunner('python', scope)
        .run(code)
        .on('finish', (runner: Runner) => {
          runner.getCurrentQuery().getResults().buffer.forEach(({k, o}) => {
            const options = JSON.parse(o);
            editorComponentInstance.getParams().overrideParam(k, {options});
          });
        });
    }
  });

  return editorComponentInstance;
}

function initRunnerComponentInstance(scope, runnerComponentInstance: RunnerComponentInstance, editorComponentDeferred) {
  editorComponentDeferred.then((editorComponentInstance: CodeEditorInstance) => {
    runnerComponentInstance.setRequestTransformer(() => {
      const params = editorComponentInstance.getParams();

      const user = params.format(scope.vm.selection || scope.model.value);
      const autogenerated = params.formatEmbed();

      return `${autogenerated}\n${user}`;
    });
  });

  return runnerComponentInstance;
}

function initRunner(runner: Runner, runnerComponentDeferred, editorComponentDeferred) {
  runner
    .on('success', () => editorComponentDeferred.then((editorComponentInstance: CodeEditorInstance) => editorComponentInstance.setValid(true)), true)
    .on('error', () => editorComponentDeferred.then((editorComponentInstance: CodeEditorInstance) => editorComponentInstance.setValid(false)), true);

  initPythonRunner(runner, runnerComponentDeferred);
}

export default () => {
  return {
    restrict: 'E',
    template,
    require: 'ngModel',
    scope: {
      runner: '=',
      version: '=',
      type: '=',
      bprOptions: '=',
      onEditorLoad: '&',
      onRunnerLoad: '&',
      onSave: '&',
      onRun: '&',
      onRunnerCreated: '&',
      onRunnerDestroyed: '&',
      onParamsShare: '&',
      downloadFileName: '&',
      readonly: '='
    },

    link: {
      pre(scope, element, attrs, ngModel) {
        const q = inject('$q');
        const runnerComponentDeferred = q.defer();
        const editorComponentDeferred = q.defer();

        const componentInstances = inject('$q').all({
          runnerComponentInstance: runnerComponentDeferred.promise,
          editorComponentInstance: editorComponentDeferred.promise,
        });

        const modelConf = createNgModel(scope, ngModel)
          .formatWith(model => ({value: model}))
          .parseWith(({value}) => value)
          .watchDeep(true)
          .then(() => scope.vm.toggle(true));

        initNgScope(scope)
          .withOptions('bprOptions', {
            focus: false,
            params: false,
            autoParams: true,
            customParams: true,
            showSyntaxErrors: true,
            fitContent: false,
            shareParams: false,
            autoRun: false,
            dateFormat: null,
          })
          .withVM({
            selection: null,
            runnerOptions: {
              buttonText: null
            },
            hint: {
              run: {
                enabled: true
              }
            },
            viz: {
              $init() {
                this.queries = this.createItemsVm({
                  type: null,
                  setCurrent(type) {
                    this.type = type;
                  },
                  $init() {
                    this.setCurrent('table');
                  }
                });
              }
            }
          })
          .withEvents({
            onRunnerLoad(instance: RunnerComponentInstance) {
              runnerComponentDeferred.resolve(initRunnerComponentInstance(scope, instance, editorComponentDeferred.promise));
              scope.onRunnerLoad({instance});
            },
            onEditorLoad(instance: CodeEditorInstance) {
              editorComponentDeferred.resolve(initEditorComponentInstance(scope, instance, runnerComponentDeferred.promise));

              if (!scope.readonly && scope.options.showSyntaxErrors) {
                attachErrorHandler(initPythonWorker, instance, modelConf).catch(console.error)
              }

              scope.onEditorLoad({instance});
            },
            onRunnerCreated(runner: Runner) {
              initRunner(runner, runnerComponentDeferred.promise, editorComponentDeferred.promise);

              scope.vm.hint.run.toggle(false);
              scope.onRunnerCreated({runner});
            },
            onRunnerDestroyed(runner) {
              componentInstances.then(({editorComponentInstance}) => {
                editorComponentInstance.setValid(null);
                editorComponentInstance.getAnnotator().hideAll();
              });

              scope.vm.hint.run.toggle(true);
              scope.onRunnerDestroyed({runner});
            },
            onRun(runner) {
              scope.onRun({runner});
            }
          });

        scope.getCtrlKeyName = () => {
          return navigator.platform === 'MacIntel' ? 'Command' : 'Ctrl';
        };
      }
    }
  };
};
