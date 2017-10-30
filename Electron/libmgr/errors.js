/*
 * Errors raised by the libmgr package.
 */

function LexError(msg, line, col) {
    var inst = new Error(msg);
    inst.lineNumber = line;
    inst.colNumber  = col;
    Object.setPrototypeOf(inst, Object.getPrototypeOf(this));
    Error.captureStackTrace(inst, LexError);
    return inst;
}

LexError.prototype = Object.create(Error.prototype);
LexError.prototype.name = "LexError";
LexError.prototype.constructor = LexError;

exports.LexError = LexError;
