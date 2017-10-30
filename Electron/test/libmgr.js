var assert = require('assert');
var tkn    = require('../libmgr/tokenizer');

describe('libmgr tokenization', function() {
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

    function generateValidData() {
        var params = [
            {
                sslo: 2, 
                sshi: 4, 
                nelo: 1, 
                nehi: 2, 
                wss: 1, 
                comment: false, 
                recWeight: 0.1
            },
            {
                sslo: 2,
                sshi: 5,
                nelo: 1,
                nehi: 3,
                wss: 1,
                comment: true,
                recWeight: 0.1
            },
            {
                sslo: 5,
                sshi: 7,
                nelo: 2,
                nehi: 4,
                wss: 1,
                comment: false,
                recWeight: 0.5
            },
            {
                sslo: 6,
                sshi: 10,
                nelo: 2,
                nehi: 4,
                wss: 1,
                comment: true,
                recWeight: 0.5
            },
            // /*
            {
                sslo: 4,
                sshi: 10,
                nelo: 5,
                nehi: 10,
                wss: 5,
                comment: false,
                recWeight: 0.7
            },
            // /*
            {
                sslo: 4,
                sshi: 9,
                nelo: 3,
                nehi: 7,
                wss: 3,
                comment: true,
                recWeight: 0.7
            },
            {
                sslo: 3,
                sshi: 12,
                nelo: 4,
                nehi: 12,
                wss: 4,
                comment: false,
                recWeight: 0.9
            },
            {
                sslo: 3,
                sshi: 12,
                nelo: 4,
                nehi: 12,
                wss: 3,
                comment: true,
                recWeight: 0.9
            } // */
        ];
        return params.map((p) =>
            reifyValidData(
                p.sslo, p.sshi, p.nelo, p.nehi, p.wss, p.comment, p.recWeight
            )
        );
    }

    function generateInvalidData() {
        return [];
    }

    describe('successful tokenization', function() {
        var lineIndependentBasesValidParse = generateValidData();
        var lineIndependentBasesInvalidParse = generateInvalidData();
        var libvpl = lineIndependentBasesValidParse.length;
        var libipl = lineIndependentBasesInvalidParse.length;

        function doValidLex(bufblock, spec) {
            return function() {
                var unixLineStrings    = spec.basis.join("\n");
                var windowsLineStrings = spec.basis.join("\r\n");
                var unixLineEndings    = Buffer.from(unixLineStrings);
                var windowsLineEndings = Buffer.from(windowsLineStrings);
                var unixLex, winLex;
                if (bufblock == 0 && windowsLineEndings.length < (1 << 12)) {
                    unixLex = (new tkn.Tokenizer()).pushBuffer(
                        unixLineEndings, 
                        true
                    );
                    winLex  = (new tkn.Tokenizer()).pushBuffer(
                        windowsLineEndings, 
                        true
                    );
                } else {
                    if (bufblock == 0) {
                        bufblock = (1 << 12);
                    }
                    var unixBlockSize = Math.ceil(
                        unixLineEndings.length / bufblock
                    );
                    var windowsBlockSize = Math.ceil(
                        windowsLineEndings.length / bufblock
                    );
                    var unixBlocks = new Array(unixBlockSize);
                    var winBlocks  = new Array(windowsBlockSize);
                    for (var i = 0, j = 0; 
                            i < unixLineEndings.length; 
                            i += bufblock, j++) {
                        unixBlocks[j] =
                            unixLineEndings.slice(i, i + bufblock);
                    }
                    for (var i = 0, j = 0; 
                            i < windowsLineEndings.length; 
                            i += bufblock, j++) {
                        winBlocks[j] =
                            windowsLineEndings.slice(i, i + bufblock);
                    }
                    var unixTkn = new tkn.Tokenizer();
                    var winTkn  = new tkn.Tokenizer();
                    unixLex = new Array(spec.expects.length);
                    winLex  = new Array(spec.expects.length);
                    var k   = 0;
                    unixBlocks.forEach(function (blk, idx) {
                        var curLex = unixTkn.pushBuffer(
                            blk, 
                            idx === unixBlocks.length
                        );
                        if (curLex.length) {
                            var cll = curLex.length;
                            for (var i = 0; i < cll; i++) {
                                unixLex[k++] = curLex[i];
                            }
                        }
                    });
                    k = 0;
                    winBlocks.forEach(function (blk, idx) {
                        var curLex = winTkn.pushBuffer(
                            blk,
                            idx === unixBlocks.length
                        );
                        if (curLex.length) {
                            var cll = curLex.length;
                            for (var i = 0; i < cll; i++) {
                                winLex[k++] = curLex[i];
                            }
                        }
                    });
                }
                function testLexResult(lexResult) {
                    lexResult.forEach((token, idx) => {
                        var expected = spec.expects[idx];
                        assert.notEqual(
                            expected, 
                            undefined, 
                            "Expected should never be undefined"
                        );
                        assert.notEqual(
                            token, 
                            undefined, 
                            "Token should never be undefined"
                        );
                        for (var key of ['type', 'line', 'column']) {
                            var got  = token[key]
                            var want = expected[key];
                            var complain = key + ' == ' + got + ' != ' + want;
                            assert.equal(token[key], expected[key], complain);
                        }
                        if ('value' in token) {
                            assert.ok(
                                'value' in expected, 
                                token + " != " + expected
                            );
                            assert.equal(
                                token.value, 
                                expected.value, 
                                token.value + " != " + expected.value
                            );
                        } else {
                            assert.ok(!('value' in expected));
                        }
                    });
                }
                testLexResult(unixLex);
                testLexResult(winLex);
            };
        }
        
        lineIndependentBasesValidParse.forEach(function (spec, idx) {
            [16, 32, 64, 0].forEach(function(bufblock) {
                var itDef = 'should correctly tokenize valid parse ';
                itDef += (idx + 1).toString()
                itDef += '/';
                itDef += libvpl.toString();
                itDef += ', bs=';
                itDef += ((bufblock == 0) ? 'all' : bufblock.toString());
                it(itDef, doValidLex(bufblock, spec));
            });
        });
    
        lineIndependentBasesInvalidParse.forEach(function (spec, idx) {
            [16, 32, 64, 0].forEach(function(bufblock) {
                var itDef = 'should correctly tokenize invalid parse ';
                itDef += (idx + 1).toString();
                itDef += '/';
                itDef += libipl.toString();
                itDef += ', bs=';
                itDef += ((bufblock == 0) ? 'all' : bufblock.toString());
                it(itDef, doValidLex(bufblock, spec));
            });
        });
    });

    describe('unsuccessful tokenization', function() {
    });
});
