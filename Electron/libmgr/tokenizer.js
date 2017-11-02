'use strict';
/* Recall the grammar of a ACF:
 * acf <- { entryspec }
 * acf <- entryspec
 * entryspec <- entryspec string value
 * entryspec <- string value
 * value <- { entryspec }
 * value <- string
 *
 * Note that there are three parsing modes, then.
 * "Normal" which eats whitespace
 * "Comment" which keeps going til the next line
 * "String" which is entered and exited with ""
 * I presume that in "String" you get a \ and keep the next thing
 *
 * Yields stuff like:
 * {
 *   "type": "{",
 *   "line": 8,
 *   "column": 8
 * }
 *
 * {
 *   "type": "string",
 *   "value": "the actual string here",
 *   "line": 8,
 *   "column": 8
 * }
 */

/*
 * Performance notes, for posterity:
 * (on Node v6.11.5, subject to change)
 * const, module-level: good
 * const, anywhere else: bad
 * let, anywhere: bad
 * for .. of: bad
 * Number instead of String for characters: good
 * Number instead of String for states: good
 * Implicit this vs. explicit object: ?
 */

const sd  = require('string_decoder');
const err = require('./errors');

const _whitespace = Array(0x80);
for (var i = 0x00; i < 0x80; i++) {
    var wsRegex    = /\s/, chr = String.fromCharCode(i);
    _whitespace[i] = wsRegex.test(chr);
}

function ccIsWhitespace(cc) {
    return (cc < 0x80) && _whitespace[cc];
}

// Mode declarations
const normalMode  = 0, commentMode = 1, stringMode = 2;
// "Type" declarations
const stringType = 'string';


function Tokenizer(encoding='utf-8') {
    this._sd       = new sd.StringDecoder(encoding);
    this._mode     = normalMode;
    this._line     = 1;
    this._col      = 0; // Start at col = 0 so that the += is always right
    // by the return time
    this._lastChr  = null;
    this._strLine  = 0;
    this._strCol   = 0;
    this._strTok   = null;
    this._strStart = 0;
}

function readableChar(chr) {
    switch (chr) {
        case '\0':
        case '\n':
        case '\r':
        case '\v':
        case '\t':
        case '\b':
        case '\f':
            return '\\' + chr;
            break;
        default:
            return chr;
            break;
    }
}

// State actions are separate, non-exported functions so that
// we can profile them using the built-in V8 profiler, which
// only samples at the function call level.

Tokenizer.prototype._doNormalChar = function (chr, cc, strOff, oot) {
    if (0x2f === cc) { // 0x2f == '/'
        if (this._lastChr === 0x2f) {
            this._mode = commentMode;
        }
        this._lastChr = cc;
        return true;
    } else if (this._lastChr === 0x2f) {
        throw new err.LexError(
            "Unexpected character after /: " + readableChar(chr),
            this._line,
            this._col
        );
    }
    if (0x0a === cc) { // 0x0a == '\n'
        this._line   += 1;
        this._col     = 0;
        this._lastChr = chr;
        return true;
    } 
    if (this._lastChr === 0x0d) { // 0x0d == '\r'
        throw new err.LexError(
            "Unexpected character after \\r: " + readableChar(chr),
            this._line,
            this._col
        );
    }
    if (0x22 === cc) { // 0x22 == '"'
        this._mode     = stringMode;
        this._strLine  = this._line;
        this._strCol   = this._col;
        this._strStart = strOff + 1;
    } else if (!(ccIsWhitespace(cc))) {
        oot[oot.length] = {
            type:   chr,
            line:   this._line,
            column: this._col
        };
    }
    return false;
}

Tokenizer.prototype._doCommentChar = function (cc) {
    if (0x0a === cc) { // 0x0a == '\n'
        this._line += 1;
        this._col   = 0;
        this._mode  = normalMode;
    }
}

Tokenizer.prototype._bumpChars = function (str, stopOff) {
    if (this._strTok) {
        this._strTok += str.substring(this._strStart, stopOff);
    } else {
        this._strTok  = str.substring(this._strStart, stopOff);
    }
    return this;
}

Tokenizer.prototype._doStringChar = function (cc, str, len, off, oot) {
    if (0x5c === this._lastChr) { // 0x5c == '\\'
        // We escaped the current character and have already set it up
        // to be included in the new substring.
        if (off === len - 1) {
            this._bumpChars(str, len);
        }
    } else if (0x22 === cc) { // 0x22 == '"'
        var goingOut;
        if (this._strTok) {
            goingOut = this._strTok + str.substring(this._strStart, off);
        } else {
            goingOut = str.substring(this._strStart, off);
        }
        oot[oot.length] = {
            type:   stringType,
            value:  goingOut,
            line:   this._strLine,
            column: this._strCol
        };
        this._strTok  = null;
        this._strLine = 0;
        this._strCol  = 0;
        this._mode    = normalMode;
    } else if (cc !== 0x5c) {
        // If this._lastChr !== '\\' then we don't want
        // to drop this current '\\' in, because it's being
        // used to drop the next one in.
        if (0x0a === cc) { // 0x0a == '\n'
            this._line += 1;
            this._col   = 0;
        }
        // By default, we just let the outer loop increment off
        // Unless we're at the very end of the string, then we have
        // to save what we've read in for the next pushBuffer
        if (off === len - 1) {
            // If there was anything left over from the pushBuffer before
            // the current pushBuffer call, then _strTok != null.
            // _strTok != null when we encounter an escape within the same
            // buffer as well.
            this._bumpChars(str, len);
        }
    } else { // cc === 0x5c == '\\'
        if (off === 0) {
            this._strStart += 1;
        } else {
            this._bumpChars(str, off);
            this._strStart = off + 1;
        }
    }
}

Tokenizer.prototype.pushBuffer = function(buf, last = false) {
    var curInput  = (last) ? this._sd.end(buf) : this._sd.write(buf);
    var cil       = curInput.length;
    var outTokens = [];
    for (var i = 0; i < cil; i++) {
        var chr    = curInput[i], cc = curInput.charCodeAt(i);
        this._col += 1;
        switch (this._mode) {
            case normalMode:
                if (this._doNormalChar(chr, cc, i, outTokens)) {
                    continue;
                }
                break;
            case commentMode:
                this._doCommentChar(cc);
                break;
            case stringMode:
                this._doStringChar(cc, curInput, cil, i, outTokens);
                break;
        }
        // '\\\\' cancels out in string mode;
        // this._lastChr === '\\' isn't even tested in others
        // Because of that, the other modes won't care that we
        // lie about the last character in the event of '\\\\'
        if (cc === 0x5c && this._lastChr === 0x5c) { // 0x5c === '\\'
            this._lastChr = 0x20; // 0x20 == ' '
        } else {
            this._lastChr = cc;
        }
    }
    this._strStart = 0;
    return outTokens;
};

Tokenizer.prototype.maybeFinished = function() {
    return this._mode != stringMode;
};

Tokenizer.prototype.bufferProgress = function() {
    return {line: this._line, column: this._col};
}

exports.Tokenizer = Tokenizer;
