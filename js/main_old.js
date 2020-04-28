/* Scripts - leaflet-lab - Dylan Harwell */

// Create Leaflet map with ESRI vector tile basemap and basemap selector
function createMap() {
    var map = L.map('map').setView([39.0702, -108.5642], 14);
    var layer = L.esri.Vector.basemap('Newspaper').addTo(map);
    L.control.scale({metric:false, position: 'bottomright'}).addTo(map);
    $('#basemaps').val('Newspaper');
    
    function setBasemap(basemap) {
        if (layer) {
            map.removeLayer(layer);
        }

        layer = L.esri.Vector.basemap(basemap);
        map.addLayer(layer);
    }
    
    document
        .querySelector('#basemaps')
        .addEventListener('change', function (e) {
            var basemap = e.target.value;
            setBasemap(basemap);
        });
    
    htmlControlToLeafletControl(map);
    getData(map);
}

// Convert symbology from default to circle
function pointToLayer(feature, latlng, attribute) {
    var attValue = Number(feature.properties[attribute]);
    var fillColor = getFillColor(attValue);
    var options = {
        fillColor: fillColor,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    }
    options.radius = calcRadius(attValue);
    var layer = L.circleMarker(latlng, options);
    createPopup(feature.properties, attribute, layer, options.radius);
    return layer;
}

// Create Popup
function createPopup(properties, attribute, layer, radius){
    //add city to popup content string
    var popupContent = "<p><b>County:</b> " + properties.county + "</p>";

    //add formatted attribute to panel content string
    var year = attribute.slice(-2);
    popupContent += "<p><b>Population Change in 20" + year + ":</b> " + properties[attribute] + "</p>";

    //replace the layer popup
    layer.bindPopup(popupContent, {
        offset: new L.Point(0,-radius)
    });
};

// Create proportional symbols
function createPropSymbols(data, map, attribute) {
    L.geoJson(data, {
        pointToLayer: function(feature, latlng) {
            return pointToLayer(feature, latlng, attribute);
        }
    }).addTo(map);
}

// Update proportional symbols
function updatePropSymbols(map, attribute) {
    map.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties[attribute]) {
            var props = layer.feature.properties;
            var radius = calcRadius(props[attribute]);
            layer.setRadius(radius);
            var fillColor = getFillColor(Number(props[attribute]));
            layer.setStyle({fillColor: fillColor});
            createPopup(props, attribute, layer, radius);
        }
    });
}

// Calculate radius to use for proportional symbols
function calcRadius(attValue) {
    var scaleFactor = 0.5;
    var area = Math.abs(attValue) * scaleFactor;
    var radius = Math.sqrt(area/Math.PI);
    return radius;
}

// Get fill color for proportional symbol options
function getFillColor(attValue) {
    var fillColor = '';
    if (attValue > 0) {
        fillColor = '#2CE82C';
    } else {
        fillColor = '#E82F2C';
    }
    return fillColor;
}

// Ajax call to retrieve data
function getData(map) {
    //load the data
    $.ajax('data/FrontRangeCounties.geojson', {
        dataType: "json",
        success: function (response) {
            var attributes = processData(response);
            var index = $('#slider').val();
            createPropSymbols(response, map, attributes[index]);
            $('.skip').click(function() { 
                var index = $('.slider').val();
                if ($(this).attr('id') == 'forward') {
                    index++;
                    //Wrap around to first attribute
                    index = index > 6 ? 0 : index;
                } else if ($(this).attr('id') == 'backward') {
                    index--;
                    index = index < 0 ? 6 : index;
                }
                $('.slider').val(index);
                updatePropSymbols(map, attributes[index]);
                updateLegend(map, attributes[index]);
            });
            $('#slider').on('input', function() {
                var index = $(this).val();
                updatePropSymbols(map, attributes[index]);
                updateLegend(map, attributes[index]);
            });
            createLegend(map, attributes[index]);
        }
    });
}

// Set slider control attributes
$('.slider').attr({
    min: 0,
    max: 6,
    value: 0,
    step: 1
});

// Disable pan/zoom interactions on custom controls
$('.custom-control').on('mousedown dblclick', function(e) {
   L.DomEvent.stopPropagation(e); 
});
$('.legend-control-container').on('mousedown dblclick', function(e) {
   L.DomEvent.stopPropagation(e); 
});

// Creates array of attribute values from data to use in sequence control
function processData(data) {
    var attributes = [];
    var properties = data.features[0].properties;
    for (var attribute in properties) {
        //only take attributes with population values
        if (attribute.indexOf('net') > -1) {
            attributes.push(attribute);
        }
    }
    return attributes;
}

// Turn range slider to Leaflet control
function htmlControlToLeafletControl(map) {
    var SliderControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        onAdd: function(map) {
            var sliderControl = L.DomUtil.get('slider-wrapper'); //jQuery selector doesn't work here?
            return sliderControl;
        }
    });
    map.addControl(new SliderControl());
}

// Create legend control
function createLegend(map, attribute) {
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'legend-control-container leaflet-bar');
            $(container).append('<div id="temporal-legend">')
            var svg = '<svg id="attribute-legend" width="215px" height="140px">';
            var circles = {
                max: 60,
                mean: 85,
                min: 110
            };
            for (var circle in circles) {
                var fillColor = getFillColor(attribute);
                svg += '<circle class="legend-circle" id="' + circle + '" fill="#2CE82C" fill-opacity="0.8" stroke="#000000" cx="80"/>';

                //text string
                svg += '<text id="' + circle + '-text" x="150" y="' + circles[circle] + '"></text>';
            }
            svg += "</svg>";
            $(container).append(svg);
            return container;
        }
    });

    map.addControl(new LegendControl());
    updateLegend(map, attribute);
}

//Calculate the max, mean, and min values for a given attribute
function getCircleValues(map, attribute) {
    var min = Infinity;
    var max = -Infinity;

    map.eachLayer(function(layer) {
        if (layer.feature) {
            var attributeValue = Math.abs(Number(layer.feature.properties[attribute]));
            if (attributeValue < min) {
                min = attributeValue;
            }
            if (attributeValue > max) {
                max = attributeValue;
            }
        }
    });

    var mean = (max + min) / 2;
    return {
        max: max,
        mean: mean,
        min: min
    };
}

// Update legend dynamically
function updateLegend(map, attribute) {
    var year = attribute.slice(-2);
    var content = '<b>Population Change in 20' + year + '</b>';

    //replace legend content
    $('#temporal-legend').html(content);

    //get the max, mean, and min values as an object
    var circleValues = getCircleValues(map, attribute);
        for (var key in circleValues) {
        var radius = calcRadius(circleValues[key]);
        $('#'+key).attr({
            cy: 125 - radius,
            r: radius
        });
        $('#'+key+'-text').text(Math.round(circleValues[key]*100)/100);
    };
};

$(document).ready(createMap);