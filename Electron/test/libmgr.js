var assert = require('assert');
var tkn    = require('../libmgr/tokenizer');
var gen    = require('./gen');

describe('libmgr tokenization', function() { 
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
            gen.reifyValidData(
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
                            idx === (unixBlocks.length - 1)
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
                            idx === (winBlocks.length - 1)
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
