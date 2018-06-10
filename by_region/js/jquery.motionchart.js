/**
 * Motion Charts v3.1
 *
 * University of California, Los Angeles
 * Statistics Online Computational Resource
 * 
 * Motion Charts is a jQuery plugin designed to render dynamic bubble charts and allows efficient and interactive exploration and visualization of longitudinal multivariate Data.
 *
 * Copyright (c) 2012 Statistics Online Computational Resource (SOCR)
 *
 * Licensed under
 *	LGPL http://www.gnu.org/licenses/lgpl.html
 *
 * http://wiki.stat.ucla.edu/socr/index.php/About_pages_for_SOCR_Motion_Charts
 *
 * @author Ramy Elkest
 */

 /*jslint plusplus: true, todo: true, white: true, browser: true */
 
(function($) {
    "use strict";

    function MotionChart(container, options) {

        // Chart variables: Kept global to enhance performance.
        var node, xScale, yScale, radiusScale, colorScale, xAxisOrient, yAxisOrient, svg, xAxis, yAxis, xLabel, yLabel, label, circle, csv, nest, duration = options.speed,
            mappingNames = [],
            mappingID = [],
            NaNMap = [],
            keyNames = [],
            playInstance,
			margin = {
				top: 39.5,
				right: 39.5,
				bottom: 39.5,
				left: 39.5
			},
            width, height,
			MapEnum = {
				key: 0,
				x: 1,
				y: 2,
				size: 3,
				color: 4,
				category: 5
			},
			priv, view, controller, chart;

        priv = {
            settings: options,
            dom: {
                $header: null,
                $tabs: null,
                $about: null,
                $content: null,
                $chart: null,
                $svg: null,
                $timeline: null,
                $play: null,
                $speedSlider: null,
                $mainSlider: null,
                $control: null,
                $table: null
            },
            playing: false,
			ie9: false,
            menuHeight: 0
        };

        view = {

            /**
             *    Creates Motion Chart View (interface)
             */
            createView: function() {
                this.build(); //Build DOM
                this.sliders(); //Initialise sliders
                this.tooltips(); //Initialise ToolTip
                this.table(); //Initialise Table
                this.resize(); //Initialise window Resizing
                this.contextMenus(); //Initialise all context Menus
                this.initWindow(); //Initialise window dimensions
            },
            /**
             * Builds the DOM for Motion Chart within the selected container and labels significant selections to increase DOM lookup speed.
             **/
            build: function() {
                var temp; //Holds jQuery objects that are not significant enough to place in priv.dom
                priv.dom.$header = $("<div class='header'>" + "<div class='title'>" + "    " + priv.settings.title + "</div>" + "</div>").appendTo(container);
                priv.dom.$tabs = $("<div class='btn-group' data-toggle='buttons-radio'>" + "    <button class='btn btn-large btn-warning active'>Chart</button>" + "    <button class='btn btn-large btn-warning'>Data</button>" + "</div>").prependTo(priv.dom.$header);
                priv.dom.$about = $("<div style='float:right'>" + "    <button class='btn btn-large btn-danger about'>About</button>" + "</div>").appendTo(priv.dom.$header);
                priv.dom.$content = $("<div class='content'>" + "</div>").appendTo(container);
                priv.dom.$chart = $("    <div class='chart' id='tab0'>" + "    </div>").appendTo(priv.dom.$content);
                priv.dom.$menu = $("        <div class='myMenuTestSub'>" + "            <div></div>" + "        </div>").appendTo(priv.dom.$chart);
                priv.dom.$svg = $("        <div class='svg'></div>").appendTo(priv.dom.$chart);
                priv.dom.$timeline = $("        <div class='timeline'>" + "        </div>").appendTo(priv.dom.$chart);
                priv.dom.$play = $("            <div class='control-button playpause play'></div>").appendTo(priv.dom.$timeline);
                temp = $("            <div class='speed-control'></div>").appendTo(priv.dom.$timeline);
                priv.dom.$speedSlider = $("            <div class='speed-control-slider'></div>").appendTo(temp);
                priv.dom.$mainSlider = $("            <div class='slider'></div>").appendTo(priv.dom.$timeline);
                priv.dom.$control = $("            <div class='slide-control'>" + "                <div class='control-button backward-skip'></div>" + "                <div class='control-button forward-skip'></div>" + "            </div>").appendTo(priv.dom.$timeline);
                priv.dom.$table = $("    <div class='dataTable' id='tab1'></div>").appendTo(priv.dom.$content);
            },

            /**
             *    Intialise main slider and speed control slider
             **/
            sliders: function() {
                priv.dom.$mainSlider.slider({
                    min: 0,
                    max: 1,
                    step: 1,
                    animate: priv.settings.speed,
                    change: function(event, ui) {
                        chart.update(ui.value);
                    }
                });
                priv.dom.$speedSlider.slider({
                    value: priv.settings.speed,
                    min: 1000,	//TODO: Link min and max to user options
                    max: 6000,
                    step: 500,
                    orientation: "vertical",
                    slide: function(event, ui) {
                        priv.dom.$speedSlider.tooltip('show');
                    },
                    change: function(event, ui) {
                        duration = ui.value;
                        priv.dom.$mainSlider.slider("option", "animate", ui.value);
                        if (priv.playing) {
                            // Click twice to reinitialise play speed
                            priv.dom.$play.trigger("click");
                            priv.dom.$play.trigger("click");
                        }
                    }
                });
            },

            /**
             *     Initialise Table (handsontable) using options
             */
            table: function() {
                priv.dom.$table.handsontable({
                    rows: 10,
                    cols: 10,
                    minSpareRows: 1,
                    minSpareCols: 1,
					undo: false,	// Disable undo to prevent memory buildup
                    contextMenu: true,
                    onChange: function(data) {
                        chart.updateData(); //If table was changed then re-bind data and mappings
                        controller.maps.setMappings();
                    }
                });
            },

            /**
             *    Initialise Tooltip for sliders and buttons
             **/
            tooltips: function() {
				priv.dom.$mainSlider.find('a.ui-slider-handle').tooltip({
                    title: function() {
                        return keyNames[priv.dom.$mainSlider.slider("value")];
                    }
                });
                priv.dom.$speedSlider.find('a.ui-slider-handle').tooltip({
                    placement: "right",
                    title: function() {
                        return (priv.dom.$speedSlider.slider("value") / 1000) + ' sec';
                    }
                });
                priv.dom.$play.tooltip({
                    title: "Play/Pause"
                });
                priv.dom.$control.find('.backward-skip').tooltip({
                    title: "Double click to skip to beggining"
                });
                priv.dom.$control.find('.forward-skip').tooltip({
                    title: "Double click to skip to end"
                });
            },

            /**
             *    Initilise window dimensions
             */
            initWindow: function() {
                // Ensure container conforms to minimum width and height
                if (container.width() < priv.settings.minWidth) { container.width(priv.settings.minWidth); }
                if (container.height() < priv.settings.minHeight) { container.height(priv.settings.minHeight); }

                // Resize to fit container
                priv.dom.$content.outerWidth(container.width());
                priv.dom.$content.outerHeight(container.height() - priv.dom.$header.outerHeight(true));

                priv.dom.$svg.outerHeight(priv.dom.$chart.height() - priv.dom.$timeline.height());

                priv.dom.$mainSlider.outerWidth(priv.dom.$timeline.width() - (priv.dom.$play.outerWidth(true) + priv.dom.$timeline.find('.speed-control').outerWidth(true) + priv.dom.$control.width() + parseInt(priv.dom.$mainSlider.css('margin-right'), 10) + parseInt(priv.dom.$mainSlider.css('margin-left'), 10) + 2)); //TODO: More efficient way?
            },

            /**
             *    Resize the view
             **/
            resize: function() {
                priv.dom.$svg.resizable({
                    minHeight: priv.settings.minHeight - priv.dom.$header.outerHeight(true) - priv.dom.$timeline.outerHeight(true),
                    minWidth: priv.settings.minWidth,
                    handles: "se",
					start: function() {
						priv.dom.$menu.trigger('mouseleave'); //Close the menu
					},
                    resize: function(event, ui) {
                        priv.dom.$header.outerWidth(priv.dom.$svg.width());
                        priv.dom.$content.width(priv.dom.$svg.width());
                        priv.dom.$chart.outerWidth(priv.dom.$content.width());
                        priv.dom.$content.height(priv.dom.$svg.height() + priv.dom.$timeline.outerHeight());

                        container.width(priv.dom.$content.outerWidth());
                        container.height(priv.dom.$content.outerHeight() + priv.dom.$header.outerHeight(true));

                        priv.dom.$mainSlider.outerWidth(priv.dom.$timeline.width() - (priv.dom.$play.outerWidth(true) + priv.dom.$timeline.find('.speed-control').outerWidth(true) + priv.dom.$control.width() + parseInt(priv.dom.$mainSlider.css('margin-right'), 10) + parseInt(priv.dom.$mainSlider.css('margin-left'), 10) + 2)); //TODO: More efficient way?
                        chart.resize();
                    }
                });
            },

            /**
             *    Initialise all Context menus. This includes:
             *    $svg context menu: Covers all mappings, scales, colormaps and Save As Image Option
             *    X-Axis label menu: Covers x-axis mappings only
             *    Y-Axis label menu: Covers y-axis mappings only
             *    Interactive Menu menu: Covers mappings, scales and colormaps seperately
             **/

            contextMenus: function() {
                // $svg Context Menu
                var defaultItems = {
                    selector: ".svg",
                    trigger: "none",
                    build: function($trigger) {
                        return {
                            items: {
                                "key": {
                                    name: "Key",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        }
                                    }
                                },
                                "xAxis": {
                                    name: "X-Axis",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        },
                                        "scale": {
                                            name: "Scale",
                                            items: {
                                                "linear": {
                                                    name: "Linear",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "log": {
                                                    name: "Log",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "sqrt": {
                                                    name: "Square Root",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "quad": {
                                                    name: "Quadratic",
                                                    callback: $trigger.data("scaleCallback")
                                                }
                                            },
                                            disabled: chart.isNaNMap(MapEnum.x)
                                        }
                                    }
                                },
                                "yAxis": {
                                    name: "Y-Axis",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        },
                                        "scale": {
                                            name: "Scale",
                                            items: {
                                                "linear": {
                                                    name: "Linear",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "log": {
                                                    name: "Log",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "sqrt": {
                                                    name: "Square Root",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "quad": {
                                                    name: "Quadratic",
                                                    callback: $trigger.data("scaleCallback")
                                                }
                                            },
                                            disabled: chart.isNaNMap(MapEnum.y)
                                        }
                                    }
                                },
                                "size": {
                                    name: "Size",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        },
                                        "scale": {
                                            name: "Scale",
                                            items: {
                                                "linear": {
                                                    name: "Linear",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "log": {
                                                    name: "Log",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "sqrt": {
                                                    name: "Square Root",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "quad": {
                                                    name: "Quadratic",
                                                    callback: $trigger.data("scaleCallback")
                                                }
                                            },
                                            disabled: chart.isNaNMap(MapEnum.size)
                                        }
/*,
                                    "setsize":
                                        {name: "Adjust Size",
                                        className: "set-size"
                                        }*/
                                        // TODO: Remove or load 2-handle slider dynamically
                                    }
                                },
                                "color": {
                                    name: "Color",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        },
                                        "scale": {
                                            name: "Scale",
                                            items: {
                                                "linear": {
                                                    name: "Linear",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "log": {
                                                    name: "Log",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "sqrt": {
                                                    name: "Square Root",
                                                    callback: $trigger.data("scaleCallback")
                                                },
                                                "quad": {
                                                    name: "Quadratic",
                                                    callback: $trigger.data("scaleCallback")
                                                }
                                            }
                                        },
                                        "setcolor": {
                                            name: "Adjust Color",
                                            className: "set-color",
                                            items: $trigger.data("colorItems")
                                        }
                                    }
                                },
                                "category": {
                                    name: "Category",
                                    items: {
                                        "map": {
                                            name: "Map",
                                            items: $trigger.data("items")
                                        }
                                    }
                                },
                                "sep1": "---------",
                                "save": {
                                    name: "Save as Image",
                                    callback: $trigger.data("saveCallback"),
                                    disabled: function() {
                                        return !( !! window.HTMLCanvasElement);
                                    } //Disable if browser does not support canvas
                                }
                            }
                        };
                    }
                };

                $.contextMenu(defaultItems);

                //X-Axis Menu
                $.contextMenu({
                    selector: "text.x.label",
                    trigger: "none",
                    build: function($trigger) {
                        return {
                            items: $trigger.data("items"),
                            position: function(opt, x, y) {
                                opt.determinePosition.call(this, opt.$menu);
                                return;
                            },
                            determinePosition: function($menu) {
                                $menu.css('display', 'block').position({
                                    my: "right bottom",
                                    at: "left bottom",
                                    of: this,
                                    offset: "-10 -5"
                                }).css('display', 'none');
                            }
                        };
                    }
                });

                //Y-Axis Menu
                $.contextMenu({
                    selector: "text.y.label",
                    trigger: "none",
                    build: function($trigger) {
                        return {
                            items: $trigger.data("items"),
                            position: function(opt, x, y) {
                                opt.determinePosition.call(this, opt.$menu);
                                return;
                            },
                            determinePosition: function($menu) {
                                $menu.css('display', 'block').position({
                                    my: "left top",
                                    at: "right top",
                                    of: this,
                                    offset: "-5 0"
                                }).css('display', 'none');
                            }
                        };
                    }
                });

                //Sliding Popover Menu Mapping
                /**
                 *    Note: Class name has to be MapEnum.$name+'Map', so x would be xMap and color would be colorMap
                 *    These elements (td) must only have one class.
                 **/
                $.contextMenu({
                    selector: ".keyMap, .xMap, .yMap, .sizeMap, .colorMap, .categoryMap",
                    trigger: "none",
                    build: function($trigger) {

                        var mapID = MapEnum[$trigger.attr('class').replace('Map', '')];

                        return {
                            items: $trigger.data("items"),
                            position: function(opt, x, y) {
                                opt.determinePosition.call(this, opt.$menu);
                                return;
                            },
                            determinePosition: function($menu) {
                                $menu.css('display', 'block').position({
                                    my: "left top",
                                    at: "right top",
                                    of: this,
                                    offset: "5 0"
                                }).css('display', 'none');
                            },
                            events: {
                                hide: function(opt) {
                                    $trigger.parents('.'+priv.dom.$menu.attr('class')).trigger('mouseenter');
                                }
                            }
                        };
                    }
                });

                //Sliding Popover Menu Scaling
                /**
                 *    Note: Class name has to be MapEnum.$name+'Map', so x would be xScale and color would be colorScale
                 *    These elements (td) must only have one class.
                 **/
                $.contextMenu({
                    selector: ".xScale, .yScale, .sizeScale, .colorScale",
                    trigger: "none",
                    build: function($trigger) {

                        var mapID = MapEnum[$trigger.attr('class').replace('Scale', '')];

                        return {
                            items: $trigger.data("items"),
                            position: function(opt, x, y) {
                                opt.determinePosition.call(this, opt.$menu);
                                return;
                            },
                            determinePosition: function($menu) {
                                $menu.css('display', 'block').position({
                                    my: "left top",
                                    at: "right top",
                                    of: this,
                                    offset: "-5 0"
                                }).css('display', 'none');
                            },
                            events: {
                                hide: function(opt) {
                                    $trigger.parents('.'+priv.dom.$menu.attr('class')).trigger('mouseenter');
                                }
                            }
                        };
                    }
                });

                //Sliding Popover Menu Coloring
                /**
                 *    Note: Class name has to be MapEnum.$name+'Map', so x would be xScale and color would be colorScale
                 *    These elements (td) must only have one class.
                 **/
                $.contextMenu({
                    selector: ".colorColorMap",
                    trigger: "none",
                    build: function($trigger) {

                        var mapID = MapEnum[$trigger.prop('class').replace('ColorMap', '')];

                        return {
                            items: $trigger.data("colorItems"),
                            position: function(opt, x, y) {
                                opt.determinePosition.call(this, opt.$menu);
                                return;
                            },
                            determinePosition: function($menu) {
                                $menu.css('display', 'block').position({
                                    my: "left top",
                                    at: "right top",
                                    of: this,
                                    offset: "-5 0"
                                }).css('display', 'none');
                            },
                            events: {
                                hide: function(opt) {
                                    $trigger.parents('.'+priv.dom.$menu.attr('class')).trigger('mouseenter');
                                }
                            }
                        };
                    }
                });

            }
        };



        controller = {

            /**
             *    Creates Controller (interaction)
             */
            createController: function() {
                this.buttons(); //Initilise buttons
                this.contextmenu(); //Initialise context menu triggers    
                this.menu(); //Initialise sliding menu
            },

            /**
             *     Initialise all buttons
             **/
            buttons: function() {
                /**
                 *    Toggle tabs on the top of the page (Chart and Data)
                 */
                priv.dom.$tabs.children('button').click(function() {
                    // If not already clicked
					if (! $(this).hasClass('active')) {
                        switch ($(this).index()) {
                        case 0:
                            priv.dom.$table.handsontable("deselectCell"); // Deselect selection to trigger onChange
                            priv.dom.$chart.slideToggle();
                            priv.dom.$table.slideToggle();
                            break;
                        case 1:
                            priv.dom.$table.slideToggle();
                            priv.dom.$chart.slideToggle();
                            break;
                        }
                    }
                });

				/**
				 *	Enable title ediiting
				 */
				priv.dom.$header.on('click','.title', function() {
					var $this = $(this),
						$parent = $this.parent();
					
					if (! $this.hasClass('edit')) {
						var currentText = $this.text().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); //escape html special chars
						$this.replaceWith('<input class="title edit" value = "'+currentText+'"/>');
						$parent.children('input').focus()
												 .blur(function(){
													var newText = $(this).val().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); //escape html special chars TODO: trim to chars to fit div
													$(this).replaceWith('<div class="title">'+((newText==='') ? settings.title : newText)+'</div>');
												});
					}
				});

                /**
                 *    Play / Pause button
                 *    Start / Stop playInstance Interval
                 */
                priv.dom.$play.click(function() {
                    var index = priv.dom.$mainSlider.slider("value"),
                        // Current value of slider (and on svg)
                        max = priv.dom.$mainSlider.slider("option", "max"); // Maximum value of slider (and of key)

                    if ($(this).hasClass("pause")) // Pause
                    {
                        clearInterval(playInstance);
                        $(this).toggleClass("play").toggleClass("pause");
                        priv.playing = false;
                        setTimeout(function() {
                            $(".slider a.ui-slider-handle").tooltip("hide");
                        }, 1000);
                    }
                    else if (index === max) { //Slider is already at maximum. 
						if (priv.settings.loop) {
							priv.dom.$mainSlider.slider("value", 0); //Restart slider
							setTimeout(function() {
								priv.dom.$play.trigger("click");
							}, priv.dom.$speedSlider.slider("value"));
							
						}
						else { //show tooltip then return without doing anything.
							priv.dom.$mainSlider.find('a.ui-slider-handle').tooltip("show");
							setTimeout(function() {
								priv.dom.$mainSlider.find('a.ui-slider-handle').tooltip("hide");
							}, 1000);
							priv.playing = false;
						}
                    }
                    else { //Play
                        $(this).toggleClass("play").toggleClass("pause");
                        priv.dom.$mainSlider.find('a.ui-slider-handle').tooltip("show");
                        priv.dom.$mainSlider.slider("value", ++index);
                        playInstance = setInterval(function() {
                            priv.dom.$mainSlider.find("a.ui-slider-handle").tooltip("show");
                            index = priv.dom.$mainSlider.slider("value");
                            if (index === max) {
								if (priv.settings.loop) {
									priv.dom.$mainSlider.slider("value", 0); //Restart slider
								}
                                else {
									priv.dom.$play.trigger("click");
								}
                            }
                            else { priv.dom.$mainSlider.slider("value", ++index); }
                        }, priv.dom.$speedSlider.slider("value"));
                        priv.playing = true;
                    }
                });

                priv.dom.$about.click(function(e) {
                    e.stopImmediatePropagation();
                    window.location.href = "http://wiki.stat.ucla.edu/socr/index.php/SOCR_HTML5_MotionCharts";
                });


                // Skip to beginning button
                priv.dom.$control.find('.backward-skip').dblclick(function() {
                    var index = priv.dom.$mainSlider.slider("value"),
                        // Current value of slider (and on svg)
                        min = priv.dom.$mainSlider.slider("option", "min"); // Minimum value of slider (and of key)
                    if (index > min) {
						priv.dom.$mainSlider.slider("value", min);
					}
                });

                // Previous step button
                priv.dom.$control.find('.backward-skip').click(function() {
                    var index = priv.dom.$mainSlider.slider("value"),
                        // Current value of slider (and on svg)
                        min = priv.dom.$mainSlider.slider("option", "min"); // Minimum value of slider (and of key)
                    if (index > min) {
						priv.dom.$mainSlider.slider("value", --index);
					}
                });

                // Next step button
                priv.dom.$control.find('.forward-skip').click(function() {
                    var index = priv.dom.$mainSlider.slider("value"),
                        // Current value of slider (and on svg)
                        max = priv.dom.$mainSlider.slider("option", "max"); // Maximum value of slider (and of key)
                    if (index < max) {
						priv.dom.$mainSlider.slider("value", ++index);
					}
                });

                // Skip to end button
                priv.dom.$control.find('.forward-skip').dblclick(function() {
                    var index = priv.dom.$mainSlider.slider("value"),
                        // Current value of slider (and on svg)
                        max = priv.dom.$mainSlider.slider("option", "max"); // Maximum value of slider (and of key)
                    if (index < max) {
						priv.dom.$mainSlider.slider("value", max);
					}
                });
            },
            /**
             *    Enable context menu interaction
             *    NOTE: The triggers were nullified in the context menu to link the callback to the relative motionchart instance
             */
            contextmenu: function() {
                /**
                 *    $content menu scale callback
                 *    @param {string} [key]            The key associated with the chosen menu option
                 *    @param {object} [options]        Not used
                 *    @param {integer} [mapID]        Maps to MapEnum, used to identify the dimension to map
                 **/

                function scaleCallback(key, options, mapID) {
                    if (mapID) {
                        controller.maps.setScale(mapID, key);
                    }
                    else {
                        controller.maps.setScale($('.context-menu-root>.context-menu-submenu.hover').index(), key);
                    }
                }
                // SVG Menu
                priv.dom.$svg.on("mousedown", function(e) {
                    if (e.which === 3) {
                        var $this = $(this);
                        $this.data("items", controller.keyItems.getMapItems());
                        $this.data("colorItems", controller.keyItems.getColorItems());
                        $this.data("scaleCallback", scaleCallback);
                        $this.data("saveCallback", controller.saveasimage);
                        $this.contextMenu({
                            x: e.pageX + 5,
                            y: e.pageY
                        });
                    }
                });

                // X-Axis label Menu
                priv.dom.$svg.find('text.x.label').on("mousedown", function() {
                    var $this = $(this);
                    $this.data("items", controller.keyItems.getMapItems(MapEnum.x));
                    $this.contextMenu();
                });
                // Y-Axis label Menu
                priv.dom.$svg.find('text.y.label').on("mousedown", function() {
                    var $this = $(this);
                    $this.data("items", controller.keyItems.getMapItems(MapEnum.y));
                    $this.contextMenu();
                });
                // Sliding menu map
                priv.dom.$menu.on('mousedown', '.keyMap, .xMap, .yMap, .sizeMap, .colorMap, .categoryMap', function() {
                    var $this = $(this),
						mapID = MapEnum[$this.attr('class').replace('Map', '')]; //Possible extention is to operate on the first class only
                    $this.data("items", controller.keyItems.getMapItems(mapID));
                    $this.contextMenu();
                });
                // Sliding menu scale
                priv.dom.$menu.on('mousedown', '.xScale, .yScale, .sizeScale, .colorScale', function() {
                    var $this = $(this),
                        mapID = MapEnum[$this.attr('class').replace('Scale', '')],
                        selectedItems;

                    // If mapping is ordinal disable scaling.
                    if (priv.settings.scalings[mapID] === "ordinal") {
                        selectedItems = {
                            ordinal: {
                                name: "Scales do not apply to text/date mappings",
                                disabled: true
                            }
                        };
                    }
                    else {
                        selectedItems = {
                            "linear": {
                                name: "Linear",
                                callback: function(key, options) {
                                    scaleCallback(key, options, mapID);
                                }
                            },
                            "log": {
                                name: "Log",
                                callback: function(key, options) {
                                    scaleCallback(key, options, mapID);
                                }
                            },
                            "sqrt": {
                                name: "Square Root",
                                callback: function(key, options) {
                                    scaleCallback(key, options, mapID);
                                }
                            },
                            "quad": {
                                name: "Quadratic",
                                callback: function(key, options) {
                                    scaleCallback(key, options, mapID);
                                }
                            }
                        };
                    }

                    $this.data("items", selectedItems);
                    $this.contextMenu();
                });
                priv.dom.$menu.on('mousedown', '.colorColorMap', function() {
                    var $this = $(this),
                        mapID = MapEnum[$this.attr('class').replace('ColorMap', '')];

                    $this.data("colorItems", controller.keyItems.getColorItems());
                    $this.contextMenu();
                });

            },
			
            /**
             * keyItems called by context menu
             * Returns an object of the current mapping and callbacks
             **/
            keyItems: {

                getMapItems: function(MapEnumValue) {
                    var i, items = {}; //Clear current map
                    if (MapEnumValue !== undefined) {
                        for (i = 0; i < mappingNames.length; i++) //Add map image to each dimension
                        {
                            items[i] = {
                                name: mappingNames[i].substring(0, 12),
                                callback: function(key) {
                                    controller.maps.setMap(MapEnumValue, key);
                                }
                            };
                        }
                    }
                    else {
                        for (i = 0; i < mappingNames.length; i++) //Add map image to each dimension
                        {
                            items[i] = {
                                name: mappingNames[i].substring(0, 12),
                                callback: function(key) {
                                    controller.maps.setMap($('.context-menu-root>.context-menu-submenu.hover').index(), key);
                                }
                            };
                        }
                    }
                    return items;
                },
                getColorItems: function() {
                    var i, items = {};
                    for (i in priv.settings.colorPalette) {
						if(priv.settings.colorPalette.hasOwnProperty(i)) {
							items[i] = {
								name: i.substring(0, 12),
								callback: function(key) {
									controller.maps.setColor(MapEnum.color, key);
								}
							};
						}
                    }
                    return items;
                }
            },

            /**
             *    Stores the current values for mappings, scales and colormaps
             **/
            maps: {
                /**
                 *     Re/Set all mappings to initial condition
                 *    Currently maps dimensions to columns directly, so MapEnum == 0 would map to column[0] and 1 - 1 so forth
                 **/
                setMappings: function() {
					var i, mapEnumValue;
                    mappingNames = priv.dom.$table.handsontable('getMappings'); //Get first row for mappings
                    for (i in MapEnum) // Set mappings and scalings
                    {
						if (MapEnum.hasOwnProperty(i)) {
							mapEnumValue = MapEnum[i];
							this.setScale(mapEnumValue, chart.isNaNMap(mapEnumValue) ? "ordinal" : priv.settings.scalings[mapEnumValue] || priv.settings.scalings[i]);
							this.setMap(mapEnumValue, (priv.settings.mappings[i] < mappingNames.length - 1) ? /*(priv.settings.mappings[mapEnumValue]) ? priv.settings.mappings[i] :*/ priv.settings.mappings[i] : mappingNames.length - 1);
						}
					}

                    this.setColor(MapEnum.color, priv.settings.color); // Set Color
                },
                // Setters
                setMap: function(keyID, mapID) {
                    priv.settings.mappings[keyID] = mappingNames[mapID];
                    mappingID[keyID] = mapID;
                    chart.updateMapping(keyID);
                    this.setScale(keyID, chart.isNaNMap(keyID) ? "ordinal" : (priv.settings.scalings[keyID] === "ordinal") ? "linear" : priv.settings.scalings[keyID]); //Reset scales to previous configuration 
                },
                setScale: function(keyID, scale) {
                    priv.settings.scalings[keyID] = scale;
                    if (scale !== "ordinal") {
                        chart.updateScale(keyID, scale);
                    } else {
						chart.update();
					}
                },
                setColor: function(keyID, color) {
                    priv.settings.color = color;
                    if (priv.settings.scalings[keyID] !== "ordinal") {
                        chart.updateColorRange(priv.settings.colorPalette[color].from, priv.settings.colorPalette[color].to);
                    }
                },
                // Getters
                getMap: function(keyID) {
                    return priv.settings.mappings[keyID];
                },
                getScale: function(keyID) {
                    return priv.settings.scalings[keyID];
                },
                getColor: function(keyID) {
                    return priv.settings.color;
                }
            },
			
            /**
             *    Initialise sliding menu
             */
            menu: function() {
                // If click is within the menu ignore
                priv.dom.$menu.click(function(e) {
                    e.stopImmediatePropagation();
					this.trigger('mouseenter');
                });

                // If click is in the container and outside the menu, close the menu
                container.click(function(e) {
                    if (priv.dom.$menu.find('table').length > 0) {
                        e.stopImmediatePropagation();
                        priv.dom.$menu.trigger('mouseleave');
                    }
                });

                priv.dom.$menu.hover(function(e) {
                    var thisSpan = $(this).find('div'), maxTextLength = Math.ceil(width/65),
						insert = '<table class="mappings" cellpadding="10" style="width:100%;">' + '<tr><td></td><td class="cat">Key</td><td class="cat">X-Axis</td><td class="cat">Y-Axis</td><td class="cat">Size</td><td class="cat">Color</td><td class="cat">Category</td></tr>' + '<tr><td class="cat">mapping</td><td class="keyMap">' + priv.settings.mappings[MapEnum.key].substring(0,maxTextLength) + '</td><td class="xMap">' + priv.settings.mappings[MapEnum.x].substring(0,maxTextLength) + '</td><td class="yMap">' + priv.settings.mappings[MapEnum.y].substring(0,maxTextLength) + '</td>' + '<td class="sizeMap">' + priv.settings.mappings[MapEnum.size].substring(0,maxTextLength) + '</td><td class="colorMap">' + priv.settings.mappings[MapEnum.color].substring(0,maxTextLength) + '</td><td class="categoryMap">' + priv.settings.mappings[MapEnum.category].substring(0,maxTextLength) + '</td></tr>' + '<tr><td class="cat">Scaling</td><td></td><td class="xScale">' + priv.settings.scalings[MapEnum.x].substring(0,maxTextLength) + '</td><td class="yScale">' + priv.settings.scalings[MapEnum.y].substring(0,maxTextLength) + '</td><td class="sizeScale">' + priv.settings.scalings[MapEnum.size].substring(0,maxTextLength) + '</td>' + '<td class="colorScale">' + priv.settings.scalings[MapEnum.color].substring(0,maxTextLength) + '</td><td></td></tr>' + '<tr><td class="cat">Color Map</td><td></td><td></td><td></td><td></td><td class="colorColorMap">' + priv.settings.color + '</td><td></td></tr></table>';

                    if ($(this).has(e.target).length !== 0) {
                        return;
                    } // If event is currently active don't do anything
                    thisSpan.html(insert).show();
                    priv.menuHeight = priv.menuHeight || thisSpan.outerHeight(true);
                    $(this).stop(true).animate({
                        width: '99%',
                        height: priv.menuHeight,
                        'z-index': '1001'
                    }, 500);

                },
                // Mouseleave
                function(e) {
                    if ($(this).has(e.target).length !== 0) {
                        return;
                    } // If event is currently active don't do anything
                    var thisSpan = $(this).find('div');
                    $(this).stop(true).animate({
                        width: '7px',
                        height: '20%',
                        'z-index': '1'
                    }, 500, function() {
                        priv.menuHeight = 0;
                        thisSpan.empty();
                    });

                });
            },
			/**
			 *	Converts SVG to PNG and opens new window to display it
			 */
            saveAsImage: function() {
                var h = priv.dom.$svg.height(),
                    w = priv.dom.$svg.width(),
                    tempX = 20,
                    $canvas = $('<canvas id="saveCanvas" style="display: none;" width=' + w + ' height=' + (h + 200) + '></canvas>').appendTo(priv.dom.$content),
                    c = $canvas[0],
                    ctx = c.getContext('2d'),
                    title = priv.dom.$header.find('.title').text(),
                    selected = d3.selectAll('.selected'),
					img,
					circles = priv.dom.$svg.find('circle'),
					newWindow;

                circles.each(function() // Add Strokes inline to canvg can render them
                {
                    var $this = $(this);
                    $this.css({
                        'stroke': $this.css('stroke'),
                        'fill-opacity': $this.css('fill-opacity'),
                        'stroke-opacity': $this.css('stroke-opacity')
                    });
                });


                canvg(c, priv.dom.$svg.html().replace(new RegExp('.*</div>'), ''), {
                    ignoreDimensions: true,
                    offsetY: 20
                }); // Remove initial div manually since getting $('svg').html() produces an error
                // Add
                ctx.font = "20px Calibri";
                ctx.fillText(title, w / 2 - ctx.measureText(title).width / 2, 20);

                // Add Mapping information at the bottom
                ctx.font = "15px Georgia";
                // Add Map names
                ctx.fillText("Key: ", tempX, h + 60);
                ctx.fillText("X-axis: ", tempX, h + 80);
                ctx.fillText("Y-axis: ", tempX, h + 100);
                ctx.fillText("Size: ", tempX, h + 120);
                ctx.fillText("Color: ", tempX, h + 140);
                ctx.fillText("Category: ", tempX, h + 160);

                // Add axis information
                tempX = (1 / 5) * w;
                ctx.fillText("Mapping", tempX, h + 30);
                ctx.fillStyle = '#6699FF';
                ctx.fillText(priv.settings.mappings[MapEnum.key], tempX, h + 60);
                ctx.fillText(priv.settings.mappings[MapEnum.x], tempX, h + 80);
                ctx.fillText(priv.settings.mappings[MapEnum.y], tempX, h + 100);
                ctx.fillText(priv.settings.mappings[MapEnum.size], tempX, h + 120);
                ctx.fillText(priv.settings.mappings[MapEnum.color], tempX, h + 140);
                ctx.fillText(priv.settings.mappings[MapEnum.category], tempX, h + 160);
                ctx.fillStyle = '#000000';

                // Add scaling information
                tempX = (3 / 5) * w;
                ctx.fillText("Scaling", tempX, h + 30);
                ctx.fillStyle = '#6699FF';
                ctx.fillText(priv.settings.scalings[MapEnum.x], tempX, h + 80);
                ctx.fillText(priv.settings.scalings[MapEnum.y], tempX, h + 100);
                ctx.fillText(priv.settings.scalings[MapEnum.size], tempX, h + 120);
                ctx.fillText(priv.settings.scalings[MapEnum.color], tempX, h + 140);
                ctx.fillStyle = '#000000';

                // Add color information
                tempX = (4 / 5) * w;
                ctx.fillText("Color Map", tempX, h + 30);
                ctx.fillStyle = '#6699FF';
                ctx.fillText(priv.settings.color, tempX, h + 140);

                img = c.toDataURL("image/png");

				newWindow = window.open('', "Save_As_Image", "width=" + w + ", height=" + (h + 250) +"toolbar=0, scrollbars=1, resizable=1");
				newWindow.document.write('<img src="'+img+'"/>');

                $canvas.detach();
				
				// Remove Added styles
				// Note: This strips all color because it doesn't fallback to the CSS straight away
				// nevertheless it gives an effect of a photo being taken which is a plus
				// If you want to remove the effect apply the colouring to the circles directly from colorScale
				circles.removeAttr("style");
				chart.update();
            }
        };


        /**
         *    Chart (represents Model in the MVC structure)
         *    Handles the SVG rendering and display
         */
        chart = {

            /**
             *    Creates SVG Chart
             */
            createChart: function() {
                this.init();
            },
            /**
             *    Initialise svg layout
             */
            init: function() {
                // Get $svg dimensions
                width = priv.dom.$svg.innerWidth() - margin.left - margin.right;
                height = priv.dom.$svg.innerHeight() - margin.top - margin.bottom;

                // Create the SVG container and set the origin.
                svg = d3.selectAll(priv.dom.$svg).append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                // The x & y axes.
                xAxisOrient = d3.svg.axis().orient("bottom");
                yAxisOrient = d3.svg.axis().orient("left");

                // Add the x-axis.
                xAxis = svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxisOrient);

                // Add the y-axis.
                yAxis = svg.append("g").attr("class", "y axis").call(yAxisOrient);

                // Add an x-axis label.
                xLabel = svg.append("text").attr("class", "x label").attr("text-anchor", "end").attr("x", width).attr("y", height - 6);

                // Add a y-axis label
                yLabel = svg.append("text").attr("class", "y label").attr("text-anchor", "end").attr("y", 6).attr("dy", ".75em").attr("transform", "rotate(-90)");

                // Add the year label; the value is set on transition.
                label = svg.append("text").attr("class", "year label").attr("text-anchor", "end").attr("y", height - 24).attr("x", width);

				// Set the browser
				priv.ie9 = navigator.userAgent.indexOf("Trident") !== -1;
            },
			/**
			 *	Resize SVG including individual components to fit container
			 */
            resize: function() {
                width = priv.dom.$svg.outerWidth() - margin.left - margin.right;
				height = priv.dom.$svg.outerHeight() - margin.top - margin.bottom;

                // re-size the SVG container.
                d3.select(priv.dom.$svg[0]).select('svg').attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom);

                // Reposition the x-axis to the bottom of the chart.
                xAxis.attr("transform", "translate(0," + height + ")");

                // Reset the axis scale to the new width and height
                (NaNMap[mappingID[MapEnum.x]]) ? xScale.rangePoints([0, width]) : xScale.range([0, width]);
                (NaNMap[mappingID[MapEnum.y]]) ? yScale.rangePoints([height, 0]) : yScale.range([height, 0]);
                xAxis.call(xAxisOrient.scale(xScale));
                yAxis.call(yAxisOrient.scale(yScale));

                //Move the xLabel to its respective position
                xLabel.attr("x", width).attr("y", height - 6);

                // Finally move all circles to their new respective positions
                node.attr("transform", function(d) {
                    return "translate(" + xScale(chart.x(d)) + //set x postion
									"," + yScale(chart.y(d)) + ")";	//set y position  
                });               
            },
			/**
			 *	Extracts data from handsontable and nests it
			 *	Creates NaNMap based on first row of values
			 */
            updateData: function() {
                var i, csvSampleValues, data, csvFormat;
				
				// Get data from data table
				data = 	priv.dom.$table.handsontable('getNonEmptyData');
				
				// Assert data isn't Empty, if it is reload default data
				if (data.length == 0) {priv.dom.$table.handsontable('loadData',settings.data); data = settings.data;}
				
                // Convert the table into comma seperated value format
				csvFormat = d3.csv.format(data);
				
                // Parse the csv format into objects
                csv = d3.csv.parse(csvFormat);

                //nest the data by key
                nest = d3.nest().key(function(d) {
                    return chart.key(d);
                }).map(csv);

                csvSampleValues = d3.values(csv[0]);
				
                for (i = 0; i < csvSampleValues.length; i++) {
                    NaNMap[i] = isNaN(csvSampleValues[i]);
                }
            },
            /**
             *    Updates the data and nodes to the current keyIndex
             *    @param {integer} index to update chart to
             */
            update: function(keyIndex) {
                // Select all circles in SVG. If keyIndex is not defined (Called by updateMapping) use current data. Otherwise Bind them to data with current key values.
                if (keyIndex !== undefined) {
                    node = svg.selectAll(".node").data(d3.values(nest)[keyIndex]);
                }

                // Enter
                circle = node.enter().append("g").attr("class", "node").append("circle").attr("class", "circle");

                // Transition/Update
                node.transition().duration(duration).ease("linear").attr("transform", function(d) {
                    return "translate(" + xScale(chart.x(d)) + "," + yScale(chart.y(d)) + ")";
                }).select('circle').attr("r", function(d) {
                    return radiusScale(chart.radius(d));
                }) //Set radius
                .style("fill", function(d) {
                    return colorScale(chart.color(d));
                }); //Set color
                // Exit
                node.exit().transition().duration(1000).remove().select('.circle').attr("r", 0);

                // Update text
                node.select('text').text(function(d) {
                    return chart.category(d).substring(0, radiusScale(chart.radius(d)) / 3);
                });

                // Re/set popovers
				node.each(chart.setPopover);
				
				// Add Hover Event to show popovers in IE9
				if (priv.ie9) {
					node.select('circle').on("mouseenter",function() {$(this).popover('show')}).on("mouseleave", function() {$(this).popover('hide')});
				}
				
                //Add click Event to display category text
                node.on("click", function(d) {
                    if (d3.select(this).classed('selected')) {
                        d3.select(this).select('text').remove();
                        d3.select(this).classed('selected', false);
                    }
                    else {
                        d3.select(this).append('text').attr("text-anchor", "middle").attr("dy", ".3em").text(function(d) {
                            if (chart.category(d)) {
								return chart.category(d).substring(0, radiusScale(chart.radius(d)) / 3);
							}
                        });
                        d3.select(this).classed('selected', true);
                    }
                });

            },
            /**
             *    Set popover with metadata for each circle
             */
            setPopover: function(d) {
				var i, outputObject, values, keys, output, x;
                return $(d3.select(this).select('circle')).popover({
                        placement: function() {
                            return ($(this.$element[0]).position().left < (3 * width / 4)) ? "right" : "left";
                        },
                        title: function() {
                            return (chart.category(d) !== undefined) ? chart.category(d) : "Data";
                        },
                        content: function() {
                            outputObject = d3.select(this).datum();

                            output = "";
                            keys = d3.keys(outputObject);
                            values = d3.values(outputObject);

                            for (i = 0; i < keys.length; i++)
							{
								output += keys[i] + " : " + values[i] + "<br>";
							}

                            return output;
                        }
                    });
            },
            /**
             * Called automatically when mapping changed through the UI
             * @param {Integer} number denoting the mapping changed. Reflected in MapEnum.
             **/
            updateMapping: function(keyID) {
                // Temporary array used to extract a specific key within an associative array (CSV)    
                var thisArray = [];

                switch (keyID) {
                case MapEnum.key:
                    // Nest CSV on a new key
                    nest = d3.nest().key(function(d) {
                        return chart.key(d);
                    }).map(csv);
                    chart.update(0); //TODO: Is this neccessary ?
					
                    // Update Slider
                    priv.dom.$mainSlider.slider("option", "max", d3.values(nest).length - 1);
                    priv.dom.$mainSlider.slider("value", 0); //Reset Slider
                    d3.entries(nest).forEach(function(d) {
                        thisArray.push(d.key);
                    });
                    keyNames = thisArray;
                    break;

                case MapEnum.x:
                    // Update x axis scale and label
                    xScale = (NaNMap[mappingID[MapEnum.x]]) ? d3.scale.ordinal().domain(thisArray, csv.forEach(function(d) {
                        thisArray.push(chart.x(d));
                    })).rangePoints([0, width]) : d3.scale.linear().domain(d3.extent(csv, chart.x)).range([0, width]);
                    xAxis.call(xAxisOrient.scale(xScale).tickFormat(null)); // Reset tick formatting to default
                    xLabel.text(mappingNames[mappingID[MapEnum.x]].substring(0,12));
                    circle.transition().duration(duration).ease("linear").attr("cx", function(d) {
                        return xScale(chart.x(d));
                    }); //set x postion
                    break;

                case MapEnum.y:
                    // Update y axis scale and label
                    yScale = (NaNMap[mappingID[MapEnum.y]]) ? d3.scale.ordinal().domain(thisArray, csv.forEach(function(d) {
                        thisArray.push(chart.y(d));
                    })).rangePoints([height, 0]) : d3.scale.linear().domain(d3.extent(csv, chart.y)).range([height, 0]);
                    yAxis.call(yAxisOrient.scale(yScale).tickFormat(null));
                    yLabel.text(mappingNames[mappingID[MapEnum.y]].substring(0, 12));
                    circle.transition().duration(duration).ease("linear").attr("cy", function(d) {
                        return yScale(chart.y(d));
                    }); //set y position
                    break;

                case MapEnum.size:
                    // Update Radius Scale
                    radiusScale = (NaNMap[mappingID[MapEnum.size]]) ? d3.scale.ordinal().domain(thisArray, csv.forEach(function(d) {
                        thisArray.push(chart.radius(d));
                    })).rangePoints([10, 40]) : d3.scale.sqrt().domain(d3.extent(csv, chart.radius)).range([10, 40]);
                    circle.transition().duration(duration).ease("linear").attr("r", function(d) {
                        return radiusScale(chart.radius(d));
                    }); //Set radius
                    break;

                case MapEnum.color:
                    // Update Color Scale
                    colorScale = (NaNMap[mappingID[MapEnum.color]]) ? d3.scale.category20() : d3.scale.linear().domain(d3.extent(csv, chart.color)).range([priv.settings.colorPalette[priv.settings.color].from, priv.settings.colorPalette[priv.settings.color].to]).interpolate(d3.interpolateRgb);
                    circle.transition().duration(duration).ease("linear").style("fill", function(d) {
                        return colorScale(chart.color(d));
                    }); //Set color
                    break;
                case MapEnum.category:
                    // Update Text attached to each node
                    node.select('text').text(function(d) {
                        if (chart.category(d)) {
							return chart.category(d).substring(0, chart.radius(d) / 3);
						}
                    });
					break;
                default:
                    // Any other mapping do nothing..
                    break;
                }

            },
            /**
             *  Updates individual dimensions' scaling type
             *  @param {Integer} number denoting the mapping changed. Reflected in MapEnum.
             *  @param {String} Denoting the scale to convert to - "linear","sqrt", "log" or "quad"
             **/
            updateScale: function(keyID, toScale) {
				var format;
                switch (keyID) {
                case MapEnum.x:
                    switch (toScale) {
                    case "linear":
                        xScale = d3.scale.linear().domain(d3.extent(csv, chart.x)).range([0, width]).nice();
                        xAxis.transition().duration(1000).call(xAxisOrient.scale(xScale));
                        break;
                    case "sqrt":
                        xScale = d3.scale.sqrt().domain(d3.extent(csv, chart.x)).range([0, width]).nice();
                        xAxis.transition().duration(1000).call(xAxisOrient.scale(xScale));
                        break;
                    case "log":
                        format = d3.format(".2d"); // for formatting integers
                        xScale = d3.scale.log().domain(d3.extent(csv, chart.x)).range([0, width]).nice();
                        xAxis.transition().duration(1000).call(xAxisOrient.scale(xScale).tickFormat(format));
                        break;
                    case "quad":
                        xScale = d3.scale.pow().exponent(2).domain(d3.extent(csv, chart.x)).range([0, width]).nice();
                        xAxis.transition().duration(1000).call(xAxisOrient.scale(xScale));
                        break;
                    }
                    break;

                case MapEnum.y:
                    switch (toScale) {
                    case "linear":
                        yScale = d3.scale.linear().domain(d3.extent(csv, chart.y)).range([height, 0]);
                        yAxis.transition().duration(1000).call(yAxisOrient.scale(yScale));
                        break;
                    case "sqrt":
                        yScale = d3.scale.sqrt().domain(d3.extent(csv, chart.y)).range([height, 0]);
                        yAxis.transition().duration(1000).call(yAxisOrient.scale(yScale));
                        break;
                    case "log":
                        format = d3.format(".0f"); // for formatting integers
                        yScale = d3.scale.log().domain(d3.extent(csv, chart.y)).range([height, 0]);
                        yAxis.transition().duration(1000).call(yAxisOrient.scale(yScale).tickFormat(format));
                        break;
                    case "quad":
                        yScale = d3.scale.pow().exponent(2).domain(d3.extent(csv, chart.y)).range([height, 0]);
                        yAxis.transition().duration(1000).call(yAxisOrient.scale(yScale));
                        break;
                    }
                    break;

                case MapEnum.size:
                    switch (toScale) {
                    case "linear":
                        radiusScale = d3.scale.sqrt().domain(d3.extent(csv, chart.radius)).range([10, 40]);
                        circle.transition().duration(1000).ease("linear").attr("r", function(d) {
                            return radiusScale(chart.radius(d));
                        }); //Set radius
                        break;
                    case "sqrt":
                        radiusScale = d3.scale.sqrt().domain(d3.extent(csv, chart.radius)).range([10, 40]);
                        circle.transition().duration(1000).ease("linear").attr("r", function(d) {
                            return radiusScale(chart.radius(d));
                        }); //Set radius
                        break;
                    case "log":
                        format = d3.format(".0f"); // for formatting integers
                        radiusScale = d3.scale.log().domain(d3.extent(csv, chart.radius)).range([10, 40]);
                        circle.transition().duration(1000).ease("linear").attr("r", function(d) {
                            return radiusScale(chart.radius(d));
                        }); //Set radius
                        break;
                    case "quad":
                        radiusScale = d3.scale.pow().exponent(2).domain(d3.extent(csv, chart.radius)).range([10, 40]);
                        circle.transition().duration(1000).ease("linear").attr("r", function(d) {
                            return radiusScale(chart.radius(d));
                        }); //Set radius
                        break;
                    }
                    break;

                case MapEnum.color:
                    switch (toScale) {
                    case "linear":
                        colorScale = d3.scale.linear().domain(d3.extent(csv, chart.color)).range([priv.settings.colorPalette[priv.settings.color].from, priv.settings.colorPalette[priv.settings.color].to]).interpolate(d3.interpolateRgb);
                        circle.transition().duration(duration).ease("linear").style("fill", function(d) {
                            return colorScale(chart.color(d));
                        }); //Set color
                        break;
                    case "sqrt":
                        colorScale = d3.scale.sqrt().domain(d3.extent(csv, chart.color)).range([priv.settings.colorPalette[priv.settings.color].from, priv.settings.colorPalette[priv.settings.color].to]).interpolate(d3.interpolateRgb);
                        circle.transition().duration(duration).ease("linear").style("fill", function(d) {
                            return colorScale(chart.color(d));
                        }); //Set color
                        break;
                    case "log":
                        colorScale = d3.scale.log().domain(d3.extent(csv, chart.color)).range([priv.settings.colorPalette[priv.settings.color].from, priv.settings.colorPalette[priv.settings.color].to]).interpolate(d3.interpolateRgb);
                        circle.transition().duration(duration).ease("linear").style("fill", function(d) {
                            return colorScale(chart.color(d));
                        }); //Set color
                        break;
                    case "quad":
                        colorScale = d3.scale.pow().exponent(2).domain(d3.extent(csv, chart.color)).range([priv.settings.colorPalette[priv.settings.color].from, priv.settings.colorPalette[priv.settings.color].to]).interpolate(d3.interpolateRgb);
                        circle.transition().duration(duration).ease("linear").style("fill", function(d) {
                            return colorScale(chart.color(d));
                        }); //Set color
                        break;
                    }
                    break;
                default:
                    //Do nothing
                    return;
                }
                //Update chart
                chart.update();
            },
            /**
             *    @param {integer} mapID mapping a value in MapEnum
             *    @return {boolean} If data column has NaN values
             */
            isNaNMap: function(mapID) {
                return NaNMap[mappingID[mapID]];
            },
            /**
             * Called automatically when color range changed through the UI
             * @param {String} RGB color - Start Range
             * @param {String} RGB color - End Range
             **/
            updateColorRange: function(from, to) {
                colorScale.range([from, to]).interpolate(d3.interpolateRgb);
                chart.update(); //Update Chart
            },
            key: function(d) {
                return (NaNMap[mappingID[MapEnum.key]]) ? d[mappingNames[mappingID[MapEnum.key]]] : +d[mappingNames[mappingID[MapEnum.key]]];
            },
            x: function(d) {
                return (NaNMap[mappingID[MapEnum.x]]) ? d[mappingNames[mappingID[MapEnum.x]]] : +d[mappingNames[mappingID[MapEnum.x]]];
            },
            y: function(d) {
                return (NaNMap[mappingID[MapEnum.y]]) ? d[mappingNames[mappingID[MapEnum.y]]] : +d[mappingNames[mappingID[MapEnum.y]]];
            },
            radius: function(d) {
                return (NaNMap[mappingID[MapEnum.size]]) ? d[mappingNames[mappingID[MapEnum.size]]] : +d[mappingNames[mappingID[MapEnum.size]]];
            },
            color: function(d) {
                return (NaNMap[mappingID[MapEnum.color]]) ? d[mappingNames[mappingID[MapEnum.color]]] : +d[mappingNames[mappingID[MapEnum.color]]];
            },
            category: function(d) {
                return d[mappingNames[mappingID[MapEnum.category]]];
            }
        };

        /**
         *    Initialise Motion Chart
         *    @public
         */
        this.init = function() {
            view.createView();
            chart.createChart();
            controller.createController();
            priv.dom.$table.handsontable("loadData", priv.settings.data);
			if (priv.settings.play) {
				setTimeout(function() {
					priv.dom.$play.trigger("click");
				}, priv.settings.speed);
			}
        };
        /**
         *    Load new data
         *    @public
         */
        this.data = function(data) {
            priv.dom.$table.handsontable("loadData", data);
        };
        /**
         *    Update priv.settings
         *    @public
         */
        this.updateSettings = function(option) {
            $.extend(true, priv.settings, option);
        };
		/**
		 *	  Update the chart Title
         *    @public
		 */
		this.title = function(newTitle) {
			priv.settings.title = newTitle;
			priv.dom.$header.find('.title').text(newTitle);
		};
        /**
         *    Destroy the instance
         *    @public
         */
        this.destroy = function() {
            container.removeClass('mchart');
            container.empty();
            container.removeData("motionchart");
        };
    }

	/**
	 *	  Default settings
	 */
    var settings = {
        title: "SOCR HTML5 Motion Chart",
        data: [
            ["Year", "Kia", "Nissan", "Toyota", "Honda"],
            ["2008", 10, 11, 12, 13],
            ["2009", 20, 11, 14, 13],
            ["2010", 30, 15, 12, 13]
            ],
        minWidth: 700,
        minHeight: 300,
		loop: false,
		play: false,
        speed: 3000,
        colorPalette: {
            "Red-Blue": {
                from: "rgb(255,0,0)",
                to: "rgb(0,0,255)"
            },
            "Green-Yellow": {
                from: "rgb(0,255,0)",
                to: "rgb(0,255,255)"
            }
        },
        color: "Red-Blue",
        mappings: {
            key: 0,
            x: 1,
            y: 2,
            size: 3,
            color: 4,
            category: 0
        },
        scalings: {
            x: "linear",
            y: "linear",
            size: "linear",
            color: "linear"
        }
    };


    $.fn.motionchart = function(action, options) {
        var i, ilen, args, output = [];
        if (typeof action !== "string") { // Initialise Motion Chart
            options = action;
            return this.each(function() {
                var $this = $(this),
                    instance,
					currentSettings;
                if ($this.data("motionchart")) {
                    instance = $this.data("motionchart"); // Get instance from DOM
                    instance.updateSettings(options); // Update Options
                }
                else {
                    currentSettings = $.extend(true, {}, settings);
                    if (options) {
                        $.extend(true, currentSettings, options); // Overwrite default setting with user settings
                    }
                    instance = new MotionChart($this, currentSettings); // Instantiate
                    $this.data("motionchart", instance); // Link instance to DOM
                    $this.addClass("mchart"); // Add class 'mchart'
                    instance.init(); // Initialise Instance
                }
            });
        }
        else { // Motion Chart Method
            args = [];
            if (arguments.length > 1) {
                for (i = 1, ilen = arguments.length; i < ilen; i++) {
                    args.push(arguments[i]);
                }
            }
            this.each(function() {
                output = $(this).data("motionchart")[action].apply(this, args); // Apply Method
            });
            return output;
        }
    };
})(jQuery);
