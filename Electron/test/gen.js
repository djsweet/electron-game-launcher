// Useful functions for generating test data.
// We use this in libmgr.js, but also to generate
// test data for profiling.

function randomFromRange(lo, hi) {
    return Math.floor(
        Math.random() * (hi - lo) + lo
    );
}

function genString(size) {
    var ret = "";
    for (var i = 0; i < size; i++) {
        var chr  = randomFromRange(0x20, 0x7e);
        var toChr = String.fromCharCode(chr);
        ret += toChr;
    }
    return ret;
}

function escapeString(str) {
    var ret = "";
    for (var chr of str) {
        if (chr === '"' || chr === '\\') {
            ret += '\\';
        }
        ret += chr;
    }
    return ret;
}

function genEntry(
    sslo, 
    sshi, 
    nelo,
    nehi,
    recWeight, 
    depth=0
) {
    var ret = [];
    var entries = randomFromRange(nelo, nehi);
    for (var i = 0; i < entries; i++) {
        var ekSize   = randomFromRange(sslo, sshi);
        var entryKey = genString(ekSize);
        ret.push({
            item: '"' + escapeString(entryKey) + '"',
            expect: {
                type: 'string',
                value: entryKey
            }
        });
        var dp = Math.random();
        if (dp < recWeight && depth < 3) {
            var prespec = genEntry(
                sslo, 
                sshi, 
                nelo,
                nehi,
                recWeight, 
                depth+1
            );
            ret.push({
                item: '{',
                expect: {
                    type: '{'
                }
            });
            ret.push(...prespec);
            ret.push({
                item: '}',
                expect: {
                    type: '}'
                }
            });
        } else {
            var vSize = randomFromRange(sslo, sshi);
            var value = genString(vSize);
            ret.push({
                item: '"' + escapeString(value) + '"',
                expect: {
                    type: 'string',
                    value: value
                }
            });
        }
    }
    return ret;
}

function reifyValidData(
    sslo, 
    sshi, 
    nelo, 
    nehi, 
    wss = 1,
    comment = false,
    recWeight = 0.2
) {
    var preSpec    = genEntry(sslo, sshi, nelo, nehi, recWeight);
    var psl        = preSpec.length;
    var postSpec   = [];
    var retStrings = [];
    var line       = 1;
    var column     = 1;
    function doPreSpec(cur) {
        var postExpects = cur.expect;
        // We have a reference to the pre-gen'd expect;
        // any modifications we do here affect cur inside preSpec
        // This is ok, we don't expect to leak preSpec
        postExpects.line   = line;
        postExpects.column = column;
        postSpec.push(postExpects);
        var psItem         = cur.item;
        for (var chr of psItem) {
            if (chr == '\n') {
                line  += 1;
                column = 1;
            } else {
                column += 1;
            }
        }
        var wstt = randomFromRange(0, wss + 1);
        for (var j = 0; j < wstt; j++) {
            psItem += ((Math.random() < 0.8) ? ' ' : '\t');
            column += 1;
        }
        return psItem;
    }
    for (var i = 0; i < psl; i++) {
        var basisEntry = doPreSpec(preSpec[i]);
        if (preSpec[i].item == '}') {
            // } entries always get their own line
            if (comment && Math.random() < 0.33) {
                basisEntry += "//";
                basisEntry += genString(sshi).replace(/\n/, '');
            }
            retStrings.push(basisEntry);
            line  += 1;
            column = 1;
            continue;
        }
        if (i < (psl - 1)) {
            i++;
        } else {
            continue; // This really shouldn't happen, but might
        }
        var doNextOnSameLine = true;
        if (preSpec[i] == '{' && Math.random() < 0.5) {
            // Sometimes, { will fall on the next line
            doNextOnSameLine = false;
        }
        if (doNextOnSameLine) {
            basisEntry += doPreSpec(preSpec[i]);
            if (comment && Math.random() < 0.25) {
                basisEntry += "//";
                basisEntry += genString(sshi).replace(/\n/, '');
            }
            retStrings.push(basisEntry);
            line  += 1;
            column = 1;
        } else {
            if (comment && Math.random() < 0.1) {
                basisEntry += "//";
                basisEntry += genString(sshi).replace(/\n/, '');
            }
            retStrings.push(basisEntry);
            line  += 1;
            column = 1;
            if (comment && Math.random() < 0.25) {
                retStrings.push("//" + genString(sshi).replace(/\n/, ''));
            }
            basisEntry = doPreSpec(preSpec[i]);
            if (comment && Math.random() < 0.1) {
                basisEntry += "//";
                basisEntry += genString(sshi).replace(/\n/, '');
            }
            retStrings.push(basisEntry);
            line  += 1;
            column = 1;
            if (comment && Math.random() < 0.05) {
                retStrings.push("//" + genString(sshi).replace(/\n/, ''));
                line += 1;
            }
        }
    }
    return {basis: retStrings, expects: postSpec};
}

function genNonModeString(sslo, sshi) {
    var retSize   = randomFromRange(sslo, sshi);
    var retString = "";
    for (var i = 0; i < retSize; i++) {
        var decide = Math.random();
        /*
         * We don't want characters that get ignored by the tokenizer
         * So ' ' and '/' are out. We also don't want '"' because we
         * don't want to enter a string.
         * That is 0x21, 0x23 - 0x2e, 0x30 - 0x7e
         *         1 +   12 +         79
         * =       92 out of 95 non-control characters
         * 1  / 92 ~= 0.011
         * 12 / 92 ~= 0.130
         * 79 / 92 ~= 0.860
         * Slight overrepresentation of 0x21 but nothing too bad.
         */
        if (decide < 0.011) {
            retString += "!";
        } else if (decide < 0.130) {
            retString += String.fromCharCode(
                (0x2e - 0x23) * (decide - 0.011) + 0x23
            );
        } else {
            retString += String.fromCharCode(
                (0x7e - 0x30) * (decide - 0.13) + 0x30
            );
        }
    }
    return retString;
}

function reifyInvalidData(sslo, sshi, nlines, wss = 1, comment = false) {
    var postSpec           = [];
    var retStrings         = [];
    var line               = 1;
    var column             = 1;
    while (retStrings.length < nlines) {
        var lineString = "";
        var wsl        = randomFromRange(0, wss + 1);
        var nItems     = randomFromRange(0, 4) + 1;
        for (var i = 0; i < wsl; i++) {
            lineString += ((Math.random() < 0.8) ? ' ' : '\t');
            column     += 1;
        }
        for (var i = 0; i < nItems; i++) {
            var curString;
            if (Math.random() < 0.5) {
                // Do proper string
                var strLen    = randomFromRange(sslo, sshi);
                var tokString = genString(strLen);
                postSpec[postSpec.length] = {
                    type:   "string",
                    value:  tokString,
                    line:   line,
                    column: column
                };
                curString = '"' + escapeString(tokString) + '"';
                for (var j = 0; j < curString.length; j++) {
                    if ('\n' === curString[j]) {
                        line  += 1;
                        column = 1;
                    } else {
                        column += 1;
                    }
                }
            } else {
                // Do in-place characters
                curString = genNonModeString(sslo, sshi);
                for (var j = 0; j < curString.length; j++) {
                    postSpec[postSpec.length] = {
                        type:   curString[j],
                        line:   line,
                        column: column
                    };
                    // We don't have to worry about newlines here
                    column += 1;
                }
            }
            lineString += curString;
            var wsl     = randomFromRange(0, wss + 1);
            for (var j = 0; j < wsl; j++) {
                lineString += ((Math.random < 0.8) ? ' ' : '\t');
                column     += 1;
            }
        }
        if (comment && Math.random() < 0.33) {
            var commentStuff = genNonModeString(sslo, sshi);
            lineString += "//";
            lineString += commentStuff;
        }
        retStrings[retStrings.length] = lineString;
        // We don't have to worry about strings ending before we get here
        // All strings have to be terminated with " anyway. The parse
        // is invalid here, but we can still lex it.
        line  += 1;
        column = 1;
    }
    return {basis: retStrings, expects: postSpec};
}

exports.genString        = genString;
exports.escapeString     = escapeString;
exports.genEntry         = genEntry;
exports.reifyValidData   = reifyValidData;
exports.reifyInvalidData = reifyInvalidData;
