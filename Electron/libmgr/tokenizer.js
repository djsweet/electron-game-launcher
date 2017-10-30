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

var sd  = require('string_decoder');
var err = require('./errors');

function Tokenizer(encoding='utf-8') {
    this._sd      = new sd.StringDecoder(encoding);
    this._mode    = 'normal';
    this._line    = 1;
    this._col     = 0; // Start at col = 0 so that the += is always right
    // by the return time
    this._lastChr = null;
    this._strLine = 0;
    this._strCol  = 0;
    this._strTok  = "";
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


Tokenizer.prototype.pushBuffer = function(buf, last = false) {
    var curInput  = (last) ? this._sd.end(buf) : this._sd.write(buf);
    var outTokens = [];
    for (var chr of curInput) {
        this._col += 1;
        switch (this._mode) {
            case 'normal': {
                if ('/' == chr) {
                    if (this._lastChr == '/') {
                        this._mode = 'comment';
                    }
                    this._lastChr = chr;
                    continue;
                } else if (this._lastChr == '/') {
                    throw new err.LexError(
                        "Unexpected character after /: " + readableChar(chr),
                        this._line,
                        this._col
                    );
                }
                if ('\n' == chr) {
                    this._line   += 1;
                    this._col     = 0;
                    this._lastChr = chr;
                    continue;
                } 
                if (this._lastChr == '\r') {
                    throw new err.LexError(
                        "Unexpected character after \\r: " + readableChar(chr),
                        this._line,
                        this._col
                    );
                }
                if (!(/\s/.test(chr))) {
                    if ('"' == chr) {
                        this._mode    = 'string';
                        this._strLine = this._line;
                        this._strCol  = this._col;
                    } else {
                        outTokens.push({
                            type:   chr,
                            line:   this._line,
                            column: this._col
                        });
                    }
                }
            }
                break;
            case 'comment': {
                if ('\n' == chr) {
                    this._line += 1;
                    this._col   = 0;
                    this._mode  = 'normal';
                }
            }
                break;
            case 'string': {
                if ('\\' == this._lastChr) {
                    this._strTok += chr;
                } else if ('"' == chr) {
                    outTokens.push({
                        type:   'string',
                        value:  this._strTok,
                        line:   this._strLine,
                        column: this._strCol
                    });
                    this._strTok  = "";
                    this._strLine = 0;
                    this._strCol  = 0;
                    this._mode    = 'normal';
                } else if (chr !== '\\') {
                    // If this._lastChr !== '\\' then we don't want
                    // to drop this current '\\' in, because it's being
                    // used to drop the next one in.
                    if ('\n' == chr) {
                        this._line += 1;
                        this._col   = 0;
                    }
                    this._strTok += chr;
                }
            }
                break;
        }
        // '\\\\' cancels out in string mode;
        // this._lastChr === '\\' isn't even tested in others
        // Because of that, the other modes won't care that we
        // lie about the last character in the event of '\\\\'
        if (chr === '\\' && this._lastChr === '\\') {
            this._lastChr = ' ';
        } else {
            this._lastChr = chr;
        }
    }
    return outTokens;
};

Tokenizer.prototype.maybeFinished = function() {
    return this._mode != 'string';
};

Tokenizer.prototype.bufferProgress = function() {
    return {'line': this._line, 'column': this._col};
}

exports.Tokenizer = Tokenizer;
