/**
 * @fileoverview enforce ordering of attributes
 * @author Erin Depew
 */
'use strict'
const utils = require('../utils')

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

/**
 * @typedef { VDirective & { key: VDirectiveKey & { name: VIdentifier & { name: 'bind' } } } } VBindDirective
 */

const ATTRS = {
  DEFINITION: 'DEFINITION',
  LIST_RENDERING: 'LIST_RENDERING',
  CONDITIONALS: 'CONDITIONALS',
  RENDER_MODIFIERS: 'RENDER_MODIFIERS',
  GLOBAL: 'GLOBAL',
  UNIQUE: 'UNIQUE',
  SLOT: 'SLOT',
  TWO_WAY_BINDING: 'TWO_WAY_BINDING',
  OTHER_DIRECTIVES: 'OTHER_DIRECTIVES',
  OTHER_ATTR: 'OTHER_ATTR',
  EVENTS: 'EVENTS',
  CONTENT: 'CONTENT'
}

/**
 * Check whether the given attribute is `v-bind` directive.
 * @param {VAttribute | VDirective | undefined | null} node
 * @returns { node is VBindDirective }
 */
function isVBind(node) {
  return Boolean(node && node.directive && node.key.name.name === 'bind')
}
/**
 * Check whether the given attribute is plain attribute.
 * @param {VAttribute | VDirective | undefined | null} node
 * @returns { node is VAttribute }
 */
function isVAttribute(node) {
  return Boolean(node && !node.directive)
}
/**
 * Check whether the given attribute is plain attribute or `v-bind` directive.
 * @param {VAttribute | VDirective | undefined | null} node
 * @returns { node is VAttribute }
 */
function isVAttributeOrVBind(node) {
  return isVAttribute(node) || isVBind(node)
}

/**
 * Check whether the given attribute is `v-bind="..."` directive.
 * @param {VAttribute | VDirective | undefined | null} node
 * @returns { node is VBindDirective }
 */
function isVBindObject(node) {
  return isVBind(node) && node.key.argument == null
}

/**
 * @param {VAttribute | VDirective} attribute
 * @param {SourceCode} sourceCode
 */
function getAttributeName(attribute, sourceCode) {
  if (attribute.directive) {
    if (isVBind(attribute)) {
      return attribute.key.argument
        ? sourceCode.getText(attribute.key.argument)
        : ''
    } else {
      return getDirectiveKeyName(attribute.key, sourceCode)
    }
  } else {
    return attribute.key.name
  }
}

/**
 * @param {VDirectiveKey} directiveKey
 * @param {SourceCode} sourceCode
 */
function getDirectiveKeyName(directiveKey, sourceCode) {
  let text = `v-${directiveKey.name.name}`
  if (directiveKey.argument) {
    text += `:${sourceCode.getText(directiveKey.argument)}`
  }
  for (const modifier of directiveKey.modifiers) {
    text += `.${modifier.name}`
  }
  return text
}

/**
 * @param {VAttribute | VDirective} attribute
 */
function getAttributeType(attribute) {
  let propName
  if (attribute.directive) {
    if (!isVBind(attribute)) {
      const name = attribute.key.name.name
      if (name === 'for') {
        return ATTRS.LIST_RENDERING
      } else if (
        name === 'if' ||
        name === 'else-if' ||
        name === 'else' ||
        name === 'show' ||
        name === 'cloak'
      ) {
        return ATTRS.CONDITIONALS
      } else if (name === 'pre' || name === 'once') {
        return ATTRS.RENDER_MODIFIERS
      } else if (name === 'model') {
        return ATTRS.TWO_WAY_BINDING
      } else if (name === 'on') {
        return ATTRS.EVENTS
      } else if (name === 'html' || name === 'text') {
        return ATTRS.CONTENT
      } else if (name === 'slot') {
        return ATTRS.SLOT
      } else if (name === 'is') {
        return ATTRS.DEFINITION
      } else {
        return ATTRS.OTHER_DIRECTIVES
      }
    }
    propName =
      attribute.key.argument && attribute.key.argument.type === 'VIdentifier'
        ? attribute.key.argument.rawName
        : ''
  } else {
    propName = attribute.key.name
  }
  if (propName === 'is') {
    return ATTRS.DEFINITION
  } else if (propName === 'id') {
    return ATTRS.GLOBAL
  } else if (propName === 'ref' || propName === 'key') {
    return ATTRS.UNIQUE
  } else if (propName === 'slot' || propName === 'slot-scope') {
    return ATTRS.SLOT
  } else {
    return ATTRS.OTHER_ATTR
  }
}

/**
 * @param {VAttribute | VDirective} attribute
 * @param { { [key: string]: number } } attributePosition
 * @returns {number | null} If the value is null, the order is omitted. Do not force the order.
 */
function getPosition(attribute, attributePosition) {
  const attributeType = getAttributeType(attribute)
  return attributePosition[attributeType] != null
    ? attributePosition[attributeType]
    : null
}

/**
 * @param {VAttribute | VDirective} prevNode
 * @param {VAttribute | VDirective} currNode
 * @param {SourceCode} sourceCode
 */
function isAlphabetical(prevNode, currNode, sourceCode) {
  const prevName = getAttributeName(prevNode, sourceCode)
  const currName = getAttributeName(currNode, sourceCode)
  if (prevName === currName) {
    const prevIsBind = isVBind(prevNode)
    const currIsBind = isVBind(currNode)
    return prevIsBind <= currIsBind
  }
  return prevName < currName
}

/**
 * @param {VAttribute | VDirective} attribute
 * @param { { name: string, directive: boolean }[] } nameAndDirectiveList
 * @param {SourceCode} sourceCode
 */
function findAttrIndex(attribute, nameAndDirectiveList, sourceCode) {
  const name = getAttributeName(attribute, sourceCode)
  const directive = isVBind(attribute)

  return nameAndDirectiveList.findIndex(
    (item) => item.name === name && item.directive === directive
  )
}

/**
 * @param {RuleContext} context - The rule context.
 * @returns {RuleListener} AST event handlers.
 */
function create(context) {
  const sourceCode = context.getSourceCode()
  let attributeOrder = [
    ATTRS.DEFINITION,
    ATTRS.LIST_RENDERING,
    ATTRS.CONDITIONALS,
    ATTRS.RENDER_MODIFIERS,
    ATTRS.GLOBAL,
    [ATTRS.UNIQUE, ATTRS.SLOT],
    ATTRS.TWO_WAY_BINDING,
    ATTRS.OTHER_DIRECTIVES,
    ATTRS.OTHER_ATTR,
    ATTRS.EVENTS,
    ATTRS.CONTENT
  ]
  if (context.options[0] && context.options[0].order) {
    attributeOrder = context.options[0].order
  }
  const alphabetical = Boolean(
    context.options[0] && context.options[0].alphabetical
  )
  const otherAttrsBind = Boolean(
    context.options[0] && context.options[0].otherAttrsBind
  )

  /** @type { { onTop: string[] } | null } */
  let exceptions = null
  if (context.options[0] && context.options[0].otherAttrsExceptions) {
    exceptions = context.options[0].otherAttrsExceptions
  }

  /** @type { { [key: string]: number } } */
  const attributePosition = {}
  attributeOrder.forEach((item, i) => {
    if (Array.isArray(item)) {
      for (const attr of item) {
        attributePosition[attr] = i
      }
    } else attributePosition[item] = i
  })

  const otherAttrPosition = attributePosition[ATTRS.OTHER_ATTR]

  /**
   * @param {VAttribute | VDirective} node
   * @param {VAttribute | VDirective} previousNode
   */
  function reportIssue(node, previousNode) {
    const currentNode = sourceCode.getText(node.key)
    const prevNode = sourceCode.getText(previousNode.key)
    context.report({
      node,
      message: `Attribute "${currentNode}" should go before "${prevNode}".`,
      data: {
        currentNode
      },

      fix(fixer) {
        const attributes = node.parent.attributes

        /** @type { (node: VAttribute | VDirective | undefined) => boolean } */
        let isMoveUp

        if (isVBindObject(node)) {
          // prev, v-bind:foo, v-bind -> v-bind:foo, v-bind, prev
          isMoveUp = isVAttributeOrVBind
        } else if (isVAttributeOrVBind(node)) {
          // prev, v-bind, v-bind:foo -> v-bind, v-bind:foo, prev
          isMoveUp = isVBindObject
        } else {
          isMoveUp = () => false
        }

        const previousNodes = attributes.slice(
          attributes.indexOf(previousNode),
          attributes.indexOf(node)
        )
        const moveNodes = [node]
        for (const node of previousNodes) {
          if (isMoveUp(node)) {
            moveNodes.unshift(node)
          } else {
            moveNodes.push(node)
          }
        }

        return moveNodes.map((moveNode, index) => {
          const text = sourceCode.getText(moveNode)
          return fixer.replaceText(previousNodes[index] || node, text)
        })
      }
    })
  }

  return utils.defineTemplateBodyVisitor(context, {
    VStartTag(node) {
      const attributeAndPositions = getAttributeAndPositionList(node)
      if (attributeAndPositions.length <= 1) {
        return
      }

      let { attr: previousNode, position: previousPosition } =
        attributeAndPositions[0]
      for (let index = 1; index < attributeAndPositions.length; index++) {
        const { attr, position } = attributeAndPositions[index]

        let valid = previousPosition <= position
        if (valid && alphabetical && previousPosition === position) {
          valid = isAlphabetical(previousNode, attr, sourceCode)
        }

        if (previousPosition === position && position === otherAttrPosition) {
          if (otherAttrsBind) {
            valid = previousNode.directive <= attr.directive

            if (
              valid &&
              alphabetical &&
              previousNode.directive === attr.directive
            ) {
              valid = isAlphabetical(previousNode, attr, sourceCode)
            }
          }

          valid = checkOtherAttrsExceptions(
            valid,
            attr,
            previousNode,
            attributeAndPositions
          )
        }

        if (valid) {
          previousNode = attr
          previousPosition = position
        } else {
          reportIssue(attr, previousNode)
        }
      }
    }
  })

  /**
   * @param {VStartTag} node
   * @returns { { attr: ( VAttribute | VDirective ), position: number }[] }
   */
  function getAttributeAndPositionList(node) {
    const attributes = node.attributes.filter((node, index, attributes) => {
      if (
        isVBindObject(node) &&
        (isVAttributeOrVBind(attributes[index - 1]) ||
          isVAttributeOrVBind(attributes[index + 1]))
      ) {
        // In Vue 3, ignore the `v-bind:foo=" ... "` and `v-bind ="object"` syntax
        // as they behave differently if you change the order.
        return false
      }
      return true
    })

    const results = []
    for (let index = 0; index < attributes.length; index++) {
      const attr = attributes[index]
      const position = getPositionFromAttrIndex(index)
      if (position == null) {
        // The omitted order is skipped.
        continue
      }
      results.push({ attr, position })
    }

    return results

    /**
     * @param {number} index
     * @returns {number | null}
     */
    function getPositionFromAttrIndex(index) {
      const node = attributes[index]
      if (isVBindObject(node)) {
        // node is `v-bind ="object"` syntax

        // In Vue 3, if change the order of `v-bind:foo=" ... "` and `v-bind ="object"`,
        // the behavior will be different, so adjust so that there is no change in behavior.

        const len = attributes.length
        for (let nextIndex = index + 1; nextIndex < len; nextIndex++) {
          const next = attributes[nextIndex]

          if (isVAttributeOrVBind(next) && !isVBindObject(next)) {
            // It is considered to be in the same order as the next bind prop node.
            return getPositionFromAttrIndex(nextIndex)
          }
        }
      }
      return getPosition(node, attributePosition)
    }
  }

  /**
   * @param {boolean} valid
   * @param {VAttribute | VDirective} node
   * @param {VAttribute | VDirective} previousNode
   * @param { { attr: ( VAttribute | VDirective ), position: number }[] } attributeAndPositions
   */

  function checkOtherAttrsExceptions(
    valid,
    node,
    previousNode,
    attributeAndPositions
  ) {
    if (!exceptions) return valid

    const otherAttrs = attributeAndPositions
      .filter((item) => item.position === otherAttrPosition)
      .map(({ attr }) => ({
        name: getAttributeName(attr, sourceCode),
        directive: isVBind(attr)
      }))

    const onTop = exceptions.onTop
      .map((item) => {
        const directive = item.startsWith(':')
        const name = directive ? item.substring(1) : item
        return { name, directive }
      })
      .filter((item) =>
        otherAttrs.some(
          (el) => item.name === el.name && item.directive === el.directive
        )
      )

    const onTopIndexPrevious = findAttrIndex(previousNode, onTop, sourceCode)
    const onTopIndexCurrent = findAttrIndex(node, onTop, sourceCode)

    if (onTopIndexCurrent === -1) {
      if (onTopIndexPrevious !== -1) valid = true
    } else if (onTopIndexCurrent !== -1) {
      valid =
        onTopIndexPrevious !== -1
          ? onTopIndexCurrent > onTopIndexPrevious
          : false
    }
    return valid
  }
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce order of attributes',
      categories: ['vue3-recommended', 'recommended'],
      url: 'https://eslint.vuejs.org/rules/attributes-order-super.html'
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: {
              anyOf: [
                { enum: Object.values(ATTRS) },
                {
                  type: 'array',
                  items: {
                    enum: Object.values(ATTRS),
                    uniqueItems: true,
                    additionalItems: false
                  }
                }
              ]
            },
            uniqueItems: true,
            additionalItems: false
          },
          alphabetical: { type: 'boolean' },
          otherAttrsBind: { type: 'boolean' },
          otherAttrsExceptions: {
            type: 'object',
            properties: {
              onTop: {
                type: 'array',
                items: {
                  type: 'string',
                  uniqueItems: true
                }
              }
            },
            minProperties: 1,
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    ]
  },
  create
}
