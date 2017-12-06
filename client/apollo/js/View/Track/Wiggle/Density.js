define([
        'dojo/_base/declare',
        'dojo/_base/array',
        'dojo/_base/lang',
        'JBrowse/Util',
        'WebApollo/ProjectionUtils',
        'JBrowse/View/Track/Wiggle/Density',
        'JBrowse/View/Track/Wiggle/_Scale'
    ],
    function(
        declare,
        array,
        lang,
        Util,
        ProjectionUtils,
        DensityTrack,
        Scale
    ) {

        return declare( DensityTrack, {

            _defaultConfig: function() {
                return Util.deepUpdate(
                    dojo.clone( this.inherited(arguments) ),
                    {
                        maxExportSpan: 500000,
                        style: {
                            height: 31,
                            pos_color: '#00f',
                            neg_color: '#f00',
                            bg_color: 'rgba(230,230,230,0.6)',
                            clip_marker_color: 'black'
                        }
                    }
                );
            },

            /* If boolean track, mask accordingly */
            _maskBySpans: function( scale, leftBase, rightBase, block, canvas, pixels, dataScale, spans ) {
                var context = canvas.getContext('2d');
                var canvasHeight = canvas.height;
                context.fillStyle = this.config.style.mask_color || 'rgba(128,128,128,0.6)';
                this.config.style.mask_color = context.fillStyle;

                for ( var index in spans ) {
                    if (spans.hasOwnProperty(index)) {
                        var w = Math.ceil(( spans[index].end   - spans[index].start ) * scale );
                        var l = Math.round(( spans[index].start - leftBase ) * scale );
                        context.fillRect( l, 0, w, canvasHeight );
                        context.clearRect( l, 0, w, canvasHeight/3);
                        context.clearRect( l, (2/3)*canvasHeight, w, canvasHeight/3);
                    }
                }
                dojo.forEach( pixels, function(p,i) {
                    if (!p) {
                        // if there is no data at a point, erase the mask.
                        context.clearRect( i, 0, 1, canvasHeight );
                    }
                });
            },

            /**
             * Override _getBlockFeatures
             */
            _getBlockFeatures: function (args) {
                var thisB = this;
                var blockIndex = args.blockIndex;
                var block = args.block;

                var leftBase = args.leftBase;
                var rightBase = args.rightBase;
                var refSeqName = this.refSeq.name ;

                var scale = args.scale;
                var finishCallback = args.finishCallback || function () {
                    };

                var canvasWidth = this._canvasWidth(args.block);

                var features = [];

                var errorCallback = dojo.hitch(this, function(e) {
                    this._handleError(e, args);
                    finishCallback(e);
                });

                // var sequenceList = ProjectionUtils.parseSequenceList(this.refSeq.name);
                // var refSeqName = sequenceList[0].name;
                var chrName ;
                // if(ProjectionUtils.isSequenceList(this.refSeq.name)){
                //     var sequenceListObject = ProjectionUtils.parseSequenceList(this.refSeq.name);
                //     console.log(sequenceListObject);
                //     chrName = sequenceListObject[0].name ;
                // }
                // else{
                //     chrName = this.refSeq.name ;
                // }
                this.getFeatures(
                    {
                        ref: refSeqName,
                        basesPerSpan: 1 / scale,
                        scale: scale,
                        start: leftBase,
                        end: rightBase + 1
                    },

                    function (f) {
                        if (thisB.filterFeature(f)){
                            // if(!f.isProjected){
                                f = ProjectionUtils.projectJSONFeature(f,refSeqName);
                            // }
                            features.push(f);
                        }
                    },
                    dojo.hitch(this, function (args) {

                        // if the block has been freed in the meantime,
                        // don't try to render
                        if (!(block.domNode && block.domNode.parentNode ))
                            return;

                        // features = features.sort(function (a,b) {
                        //     return a.data.start - b.data.start ;
                        // });
                        console.log('A')
                        console.log(features)

                        var featureRects = array.map(features, function (f) {
                            // f = ProjectionUtils.projectJSONFeature(f,refSeqName);
                            return this._featureRect(scale, leftBase, canvasWidth, f);
                        }, this);

                        block.features = features;
                        block.featureRects = featureRects;
                        block.pixelScores = this._calculatePixelScores(this._canvasWidth(block), features, featureRects);

                        if (args && args.maskingSpans)
                            block.maskingSpans = args.maskingSpans; // used for masking

                        finishCallback();
                    }),
                    errorCallback
                );
            },

            _featureRect: function( scale, leftBase,  canvasWidth, feature ) {
                // console.log('leftBase: ' + leftBase);
                // console.log('start: '+feature.get('start'));
                // console.log('scale: '+scale);


                // if(ProjectionUtils.isSequenceList(this.refSeq.name)){
                //     console.log(feature) ;
                //     feature = ProjectionUtils.projectJSONFeature(feature,this.refSeq.name);
                //     console.log('bases: '+leftBase+ ' '+rightBase) ;
                //     var projectedBases = ProjectionUtils.projectCoordinates(this.refSeq.name,leftBase,rightBase);
                //     leftBase = projectedBases[0];
                //     console.log('projected bases: '+projectedBases) ;
                // }
                // if(ProjectionUtils.isSequenceList(this.refSeq.name)){
                //     // feature = ProjectionUtils.projectJSONFeature(feature,this.refSeq.name);
                //     var fRect = {
                //         w: Math.ceil(( feature.get('_original_end')   - feature.get('_original_start') ) * scale ),
                //         l: Math.round(( feature.get('_original_start') - leftBase ) * scale )
                //     };
                // }
                // else{
                    var fRect = {
                        w: Math.ceil(( feature.get('end')   - feature.get('start') ) * scale ),
                        l: Math.round(( feature.get('start') - leftBase ) * scale )
                    };
                // }




                // if fRect.l is negative (off the left
                // side of the canvas), clip off the
                // (possibly large!) non-visible
                // portion
                // console.log('A');
                // console.log(fRect);
                if( fRect.l < 0 ) {
                    fRect.w += fRect.l;
                    fRect.l  = 0;
                }
                // console.log('B');
                // console.log(fRect);

                // also don't let fRect.w get overly big
                if(canvasWidth >= fRect.l){
                    fRect.w = Math.min( canvasWidth-fRect.l, fRect.w );
                }
                fRect.r = fRect.w + fRect.l;
                // console.log('C');
                // console.log(fRect);

                // if(fRect.l > fRect.r){
                //     fRect.w = -fRect.w ;
                //     var temp = fRect.l ;
                //     fRect.l = fRect.r ;
                //     fRect.r = temp ;
                // }

                return fRect;
            },

            _calculatePixelScores: function( canvasWidth, features, featureRects ) {
                var scoreType = this.config.scoreType;
                var pixelValues = new Array( canvasWidth );
                if(!scoreType||scoreType=="maxScore") {
                    // make an array of the max score at each pixel on the canvas
                    dojo.forEach( features, function( f, i ) {
                        // if (!f.isProjected) {
                        //     f = ProjectionUtils.projectJSONFeature(f, this.refSeq.name);
                        // }
                        var store = f.source;
                        var fRect = featureRects[i];
                        var jEnd = fRect.r;
                        var score = f.get(scoreType)||f.get('score');
                        for( var j = Math.round(fRect.l); j < jEnd; j++ ) {
                            if ( pixelValues[j] && pixelValues[j]['lastUsedStore'] == store ) {
                                /* Note: if the feature is from a different store, the condition should fail,
                                 *       and we will add to the value, rather than adjusting for overlap */
                                pixelValues[j]['score'] = Math.max( pixelValues[j]['score'], score );
                            }
                            else if ( pixelValues[j] ) {
                                pixelValues[j]['score'] = pixelValues[j]['score'] + score;
                                pixelValues[j]['lastUsedStore'] = store;
                            }
                            else {
                                pixelValues[j] = { score: score, lastUsedStore: store, feat: f };
                            }
                        }
                    },this);
                    // when done looping through features, forget the store information.
                    for (var i=0; i<pixelValues.length; i++) {
                        if ( pixelValues[i] ) {
                            delete pixelValues[i]['lastUsedStore'];
                        }
                    }
                }
                else if(scoreType=="avgScore") {
                    // make an array of the average score at each pixel on the canvas
                    dojo.forEach( features, function( f, i ) {
                        // if (!f.isProjected) {
                        //     f = ProjectionUtils.projectJSONFeature(f, this.refSeq.name);
                        // }
                        var store = f.source;
                        var fRect = featureRects[i];
                        var jEnd = fRect.r;
                        var score = f.get('score');
                        for( var j = Math.round(fRect.l); j < jEnd; j++ ) {
                            // bin scores according to store
                            if ( pixelValues[j] && store in pixelValues[j]['scores'] ) {
                                pixelValues[j]['scores'][store].push(score);
                            }
                            else if ( pixelValues[j] ) {
                                pixelValues[j]['scores'][store] = [score];
                            }
                            else {
                                pixelValues[j] = { scores: {}, feat: f };
                                pixelValues[j]['scores'][store] = [score];
                            }
                        }
                    },this);
                    // when done looping through features, average the scores in the same store then add them all together as the final score
                    for (var i=0; i<pixelValues.length; i++) {
                        if ( pixelValues[i] ) {
                            pixelValues[i]['score'] = 0;
                            for ( var store in pixelValues[i]['scores']) {
                                var j, sum = 0, len = pixelValues[i]['scores'][store].length;
                                for (j = 0; j < len; j++) {
                                    sum += pixelValues[i]['scores'][store][j];
                                }
                                pixelValues[i]['score'] += sum / len;
                            }
                            delete pixelValues[i]['scores'];
                        }
                    }
                }
                return pixelValues;
            },

            // // TODO: implement ;
            // getRegionStats: function(args){
            //     console.log('getting region stats: '+args)
            // },
            //
            // // TODO: implement ;
            // getGlobalStats: function(args){
            //     console.log('getting global stats: '+ args)
            // },

            /**
             * Override _getScalingStats
             */
            _getScalingStats: function( viewArgs, callback, errorCallback ) {
                if( ! Scale.prototype.needStats( this.config ) ) {
                    callback( null );
                    return null;
                }
                else if( this.config.autoscale == 'local' ) {
                    var region = lang.mixin( { scale: viewArgs.scale }, this.browser.view.visibleRegion() );
                    // region.ref = ProjectionUtils.parseSequenceList(region.ref)[0].name;
                    // region.start = Math.ceil( region.start );
                    // region.end = Math.floor( region.end );
                    return this.getRegionStats.call( this, region, callback, errorCallback );
                }
                else {
                    return this.getGlobalStats.call( this, callback, errorCallback );
                }
            }
        });
    });