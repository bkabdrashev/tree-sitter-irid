const PREC = {
  assignment: 1,
  comma: 2,
  arrow: 3,
  question: 4,
  pipe_pipe: 5,
  and_and: 6,
  compare: 7,
  sum: 8,
  product: 9,
  prefix: 10,
  suffix: 11,
  dot: 11,
};

export default grammar({
  name: 'irid',

  extras: $ => [
    $.line_comment,
    $.block_comment,
    /\s/
  ],

  word: $ => $.identifier,
  conflicts: $=> [
    [ $.statement, $.tuple ],
  ],

  rules: {
    source_file: $ => repeat(seq($.statement, optional(';'))),

    statement: $ => choice(
      seq('do', $.statement),
      $.declaration,
      $.while_statement,
      $.return_statement,
      $.break_statement,
      $.assignment,
      $.expression,
    ),

    declaration: $ => seq(
      field("name", $.identifier),
      ':',
      $.expression,
    ),
    assignment: $ => prec(PREC.assignment, seq(
      $.tuple,
      choice("=", "+=", "-=", "^=", "*=", "%=", "/=", "&&=", "||=", "&=", "|=", "<<=", ">>="),
      $.tuple,
    )),

    while_statement: $ => seq(
      'while',
      $.expression,
      $.statement
    ),
    return_statement: $ => prec.right(seq(
      'return',
      optional($.tuple),
    )),
    break_statement: $ => prec.right(seq(
      'break',
      optional($.tuple),
    )),

    expression: $ => choice(
      $.block,
      $.prefix_expression,
      $.infix_expression,
      $.suffix_expression,
      $.call_expression,
      $.array_expression,
      $.type_basic,
      $.identifier,
      $.record,
      $.number_literal,
      $.string_literal,
    ),

    type_basic: $ => choice(
      ...[8, 16, 32, 64].map(n => `B${n}`),
      ...[8, 16, 32, 64].map(n => `I${n}`),
      ...[16, 32, 64].map(n => `F${n}`),
    ),

    infix_expression: $ => choice(
      prec.left(PREC.arrow, seq($.expression, '->', $.expression)),
      prec.left(PREC.pipe_pipe, seq($.expression, choice('||', '\\', '..'), $.expression)),
      prec.left(PREC.and_and, seq($.expression, '&&', $.expression)),
      prec.left(PREC.compare, seq($.expression, choice('==', '!=', '>=', '>', '<', '<='), $.expression)),
      prec.left(PREC.sum, seq($.expression, choice('+', '-', '|'), $.expression)),
      prec.left(PREC.sum, seq($.expression, '^', $.expression)),
      prec.left(PREC.product, seq($.expression, choice('&', '*', '/', '%', '<<', '>>'), $.expression)),
      prec.left(PREC.dot, seq($.expression, '.', $.expression)),
      prec.left(PREC.dot, seq($.expression, '\'', $.expression))
    ),

    prefix_expression: $ => choice(
      prec.right(seq("if", $.expression, "do", $.statement, optional(seq('else', $.statement)))),
      prec.right(seq("#c", $.expression)),
      prec(PREC.prefix, seq(choice('-', '+', '!'), $.expression)),
      prec(PREC.prefix, seq('@', $.expression)),
      prec(PREC.prefix, seq('bits', $.expression)),

    ),
    suffix_expression: $ => choice(
      prec(PREC.suffix, seq($.expression, choice('++', '--'))),
      prec(PREC.suffix, seq($.expression, '@')),
    ),
    call_expression: $ => prec.left(PREC.suffix, seq(
      $.expression,
      $.record
    )),

    // Subscript as a suffix operator with high precedence
    array_expression: $ => prec.left(PREC.suffix, seq(
      $.expression,
      $.subscript
    )),
    subscript: $ => seq(
      '[',
      $.expression,
      ']'
    ),
    block: $ => seq(
      '{',
      repeat(seq($.statement, optional(';'))),
      '}'
    ),
    named_field: $=> seq($.identifier, ':', $.expression),
    record: $ => seq(
      '(',
      optional(repeat(
        seq(choice($.named_field, $.expression), optional(','))
      )),
      ')'
    ),
    number_literal: _ => {
      const separator = '\'';
      const hex = /[0-9a-fA-F]/;
      const decimal = /[0-9]/;
      const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
      const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
      return token(seq(
        optional(/[-\+]/),
        optional(choice(/0[xX]/, /0[bB]/)),
        seq(
          choice(
            decimalDigits,
            seq(/0[bB]/, decimalDigits),
            seq(/0[xX]/, hexDigits),
          ),
          optional(seq('.', optional(hexDigits))),
        ),
        optional(seq(
          /[eEpP]/,
          optional(seq(
            optional(/[-\+]/),
            hexDigits,
          )),
        )),
      ));
    },

    // Must concatenate at least 2 nodes, one of which must be a string_literal.
    // Identifier is added to parse macros that are strings, like PRIu64.
    concatenated_string: $ => prec.right(seq(
      choice(
        seq($.identifier, $.string_literal),
        seq($.string_literal, $.string_literal),
        seq($.string_literal, $.identifier),
      ),
      repeat(choice($.string_literal, $.identifier)),
    )),

    string_literal: $ => seq(
      choice('L"', 'u"', 'U"', 'u8"', '"'),
      repeat(choice(
        alias(token.immediate(prec(1, /[^\\"\n]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),

    escape_sequence: _ => token(prec(1, seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{1,4}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/,
      ),
    ))),

    tuple: $ => prec.left(commaSep1(seq($.expression))),

    identifier: $ => /[A-Za-z_]\w*/,

    line_comment: $ => seq('//', /[^\n]*/),
    block_comment: $ => seq(
      "/*",
      optional($.comment_text),
      "*/"
    ),
    comment_text: $ => repeat1(/.|\n|\r/),
  }
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
