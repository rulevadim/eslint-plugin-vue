/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
'use strict'

const utils = require('../utils')

/**
 * @typedef { 'script-setup' | 'composition' | 'options' } PreferOption
 *
 * @typedef {PreferOption[]} UserPreferOption
 *
 * @typedef {object} NormalizeOptions
 * @property {object} allowsSFC
 * @property {boolean} [allowsSFC.scriptSetup]
 * @property {boolean} [allowsSFC.composition]
 * @property {boolean} [allowsSFC.options]
 * @property {object} allowsOther
 * @property {boolean} [allowsOther.composition]
 * @property {boolean} [allowsOther.options]
 */

/** @type {PreferOption[]} */
const STYLE_OPTIONS = ['script-setup', 'composition', 'options']

/**
 * Normalize options.
 * @param {any[]} options The options user configured.
 * @returns {NormalizeOptions} The normalized options.
 */
function parseOptions(options) {
  /** @type {NormalizeOptions} */
  const opts = { allowsSFC: {}, allowsOther: {} }

  /** @type {UserPreferOption} */
  const preferOptions = options[0] || ['script-setup', 'composition']
  for (const prefer of preferOptions) {
    if (prefer === 'script-setup') {
      opts.allowsSFC.scriptSetup = true
    } else if (prefer === 'composition') {
      opts.allowsSFC.composition = true
      opts.allowsOther.composition = true
    } else if (prefer === 'options') {
      opts.allowsSFC.options = true
      opts.allowsOther.options = true
    }
  }

  if (!opts.allowsOther.composition && !opts.allowsOther.options) {
    opts.allowsOther.composition = true
    opts.allowsOther.options = true
  }

  return opts
}

const OPTIONS_API_OPTIONS = new Set([
  'mixins',
  'extends',
  // state
  'data',
  'computed',
  'methods',
  'watch',
  'provide',
  'inject',
  // lifecycle
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
  'deactivated',
  'beforeDestroy',
  'beforeUnmount',
  'destroyed',
  'unmounted',
  'render',
  'renderTracked',
  'renderTriggered',
  'errorCaptured',
  // public API
  'expose'
])
const COMPOSITION_API_OPTIONS = new Set(['setup'])

const LIFECYCLE_HOOK_OPTIONS = new Set([
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
  'deactivated',
  'beforeDestroy',
  'beforeUnmount',
  'destroyed',
  'unmounted',
  'renderTracked',
  'renderTriggered',
  'errorCaptured'
])

/**
 * @typedef { 'script-setup' | 'composition' | 'options' } ApiStyle
 */

/**
 * @param {object} allowsOpt
 * @param {boolean} [allowsOpt.scriptSetup]
 * @param {boolean} [allowsOpt.composition]
 * @param {boolean} [allowsOpt.options]
 */
function buildAllowedPhrase(allowsOpt) {
  const phrases = []
  if (allowsOpt.scriptSetup) {
    phrases.push('`<script setup>`')
  }
  if (allowsOpt.composition) {
    phrases.push('Composition API')
  }
  if (allowsOpt.options) {
    phrases.push('Options API')
  }
  return phrases.length > 2
    ? `${phrases.slice(0, -1).join(',')} or ${phrases.slice(-1)[0]}`
    : phrases.join(' or ')
}

/**
 * @param {object} allowsOpt
 * @param {boolean} [allowsOpt.scriptSetup]
 * @param {boolean} [allowsOpt.composition]
 * @param {boolean} [allowsOpt.options]
 */
function isPreferScriptSetup(allowsOpt) {
  if (!allowsOpt.scriptSetup || allowsOpt.composition || allowsOpt.options) {
    return false
  }
  return true
}

/**
 * @param {string} name
 */
function buildOptionPhrase(name) {
  return LIFECYCLE_HOOK_OPTIONS.has(name)
    ? `\`${name}\` lifecycle hook`
    : name === 'setup' || name === 'render'
    ? `\`${name}\` function`
    : `\`${name}\` option`
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce component API style',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/component-api-style.html'
    },
    fixable: null,
    schema: [
      {
        type: 'array',
        items: {
          enum: STYLE_OPTIONS,
          uniqueItems: true,
          additionalItems: false
        },
        minItems: 1
      }
    ],
    messages: {
      disallowScriptSetup:
        '`<script setup>` is not allowed in your project. Use {{allowedApis}} instead.',
      disallowComponentOption:
        '{{disallowedApi}} is not allowed in your project. {{optionPhrase}} is the API of {{disallowedApi}}. Use {{allowedApis}} instead.',
      disallowComponentOptionPreferScriptSetup:
        '{{disallowedApi}} is not allowed in your project. Use `<script setup>` instead.'
    }
  },
  /** @param {RuleContext} context */
  create(context) {
    const options = parseOptions(context.options)

    return utils.compositingVisitors(
      {
        Program() {
          if (options.allowsSFC.scriptSetup) {
            return
          }
          const scriptSetup = utils.getScriptSetupElement(context)
          if (scriptSetup) {
            context.report({
              node: scriptSetup.startTag,
              messageId: 'disallowScriptSetup',
              data: {
                allowedApis: buildAllowedPhrase(options.allowsSFC)
              }
            })
          }
        }
      },
      utils.defineVueVisitor(context, {
        onVueObjectEnter(node) {
          const allows = utils.isSFCObject(context, node)
            ? options.allowsSFC
            : options.allowsOther
          if (allows.composition && allows.options) {
            return
          }
          const disallows = [
            {
              allow: allows.composition,
              options: COMPOSITION_API_OPTIONS,
              api: 'Composition API'
            },
            {
              allow: allows.options,
              options: OPTIONS_API_OPTIONS,
              api: 'Options API'
            }
          ].filter(({ allow }) => !allow)
          for (const prop of node.properties) {
            if (prop.type !== 'Property') {
              continue
            }
            const name = utils.getStaticPropertyName(prop)
            if (!name) {
              continue
            }
            for (const { options, api } of disallows) {
              if (options.has(name)) {
                context.report({
                  node: prop.key,
                  messageId: isPreferScriptSetup(allows)
                    ? 'disallowComponentOptionPreferScriptSetup'
                    : 'disallowComponentOption',
                  data: {
                    disallowedApi: api,
                    optionPhrase: buildOptionPhrase(name),
                    allowedApis: buildAllowedPhrase(allows)
                  }
                })
              }
            }
          }
        }
      })
    )
  }
}
