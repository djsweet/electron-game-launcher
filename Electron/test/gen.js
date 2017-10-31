// Useful functions for generating test data.
// We use this in libmgr.js, but also to generate
// test data for profiling.

function genString(size) {
    var ret = "";
    for (var i = 0; i < size; i++) {
        var lo   = 0x20;
        var hi   = 0x7e;
        var chr  = Math.floor(
            Math.random() * (hi - lo) + lo
        );
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
    var entries = Math.floor(
        Math.random() * (nehi - nelo) + nelo
    );
    for (var i = 0; i < entries; i++) {
        var ekSize = Math.floor(
            Math.random() * (sshi - sslo) + sslo
        );
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
            var vSize = Math.floor(
                Math.random() * (sshi - sslo) + sslo
            );
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
        var wstt = Math.floor(
            Math.random() * (wss + 1)
        );
        for (var j = 0; j < wstt; j++) {
            var wscnf = Math.random();
            if (wscnf < 0.8) {
                psItem += ' ';
            } else {
                psItem += '\t';
            }
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

exports.genString      = genString;
exports.escapeString   = escapeString;
exports.genEntry       = genEntry;
exports.reifyValidData = reifyValidData;
