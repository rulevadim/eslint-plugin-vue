/**
 * @fileoverview Prevents duplication of field names.
 * @author Armano
 */
'use strict'

const utils = require('../utils')

/**
 * @typedef {import('../utils').GroupName} GroupName
 */

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------
/** @type {GroupName[]} */
const GROUP_NAMES = [
  'props',
  'computed',
  'data',
  'asyncData',
  'methods',
  'setup'
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow duplication of field names',
      categories: ['vue3-essential', 'essential'],
      url: 'https://eslint.vuejs.org/rules/no-dupe-keys.html'
    },
    fixable: null, // or "code" or "whitespace"
    schema: [
      {
        type: 'object',
        properties: {
          groups: {
            type: 'array'
          }
        },
        additionalProperties: false
      }
    ]
  },
  /** @param {RuleContext} context */
  create(context) {
    const options = context.options[0] || {}
    const groups = new Set(GROUP_NAMES.concat(options.groups || []))

    // ----------------------------------------------------------------------
    // Public
    // ----------------------------------------------------------------------

    return utils.executeOnVue(context, (obj) => {
      const usedNames = []
      const properties = utils.iterateProperties(obj, groups)

      for (const o of properties) {
        if (usedNames.indexOf(o.name) !== -1) {
          context.report({
            node: o.node,
            message: "Duplicated key '{{name}}'.",
            data: {
              name: o.name
            }
          })
        }

        usedNames.push(o.name)
      }
    })
  }
}
