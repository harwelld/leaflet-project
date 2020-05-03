/* Scripts - GEOG 575 - project - Dylan Harwell */

// GLobal tracking vars
var streetViewActive = false;
var pointsLoaded = false;

// Create Leaflet map with ESRI vector tile basemap and basemap selector
function createMap() {
    var map = L.map('map', {
        editable: true,
        doubleClickZoom: false
    }).setView([39.0665, -108.560], 15);
    L.control.scale({ metric: false, position: 'bottomright' }).addTo(map);
    
    // Custom attribution to map credits section
    map.attributionControl.addAttribution('<a href="https://esri.github.io/esri-leaflet/" title="Leaflet plugin for working with ESRI feature layers" target="_blank">Esri Leaflet</a>');
    map.attributionControl.addAttribution('<a href="http://leaflet.github.io/Leaflet.draw/docs/leaflet-draw-latest.html" title="Leaflet plugin for drawing on maps" target="_blank">Leaflet Draw</a>');
    map.attributionControl.addAttribution('<a href="https://github.com/GreenInfo-Network/L.Control.AccordionLegend" title="An interactive accordion legend for Leaflet maps" target="_blank">GreenInfo-Network</a>');
    map.attributionControl.addAttribution('<a href="https://www.w3schools.com/w3css/default.asp" title="CSS Framework" target="_blank">W3 CSS</a>');
    map.attributionControl.addAttribution('Dylan Harwell - UW Madison');
    
    // Add basemap, set dropdown value, create listener and change function
    var layer = L.esri.Vector.basemap('Navigation').addTo(map);
    $('#basemap-selector').val('Navigation');
    $('#basemap-selector').on('change', function(e) {
        var basemap = e.target.value;
        setBasemap(basemap);
    }); 
    function setBasemap(basemap) {
        if (layer) {
            map.removeLayer(layer);
        }
        layer = L.esri.Vector.basemap(basemap).addTo(map);
    }
    
    // Map click listener if Google Street View tool is active
    map.on('click', function(e) {
        if (streetViewActive) { googleStreet(e); }
    });
    
    // Circlemarker is actually a polygon, default marker icon is dumb
    var redlinePointIcon = new L.icon({ iconUrl: './img/redCircle.png', iconSize: [16, 16] });

    // Initialize map layers from hosted feature layers
    // Probably much better way to handle symbology on pipe inspections, but hey its like using ArcMap definition queries
    var pipes = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeSymbology
    }).addTo(map);
    
    var over3Years = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionOver3YearsSymbology
    });
    
    var under3Years = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionUnder3YearsSymbology
    });
    
    var under1Year = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionUnder1YearSymbology
    });
    
    var under1Month = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspection1MonthSymbology
    });
    
    var structures = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormStructures/FeatureServer/0",
        pointToLayer: function(geojson, latlng) {
            return L.marker(latlng, { icon: structureIcons(geojson) });
        }
    });
    
    // Redline layers with special edit functionality
    var redlinePoint = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/RedlinePoint/FeatureServer/0",
        pointToLayer: function(geojson, latlng) {
            return L.marker(latlng, {icon: redlinePointIcon});
        },
        onEachFeature: function(feature, layer) {
            attributeEditPopup(feature, layer, redlinePoint, map);
        }
    });
    
    var redlineLine = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/RedlineLine/FeatureServer/0",
        color: '#f50505',
        onEachFeature: function(feature, layer) {
            attributeEditPopup(feature, layer, redlineLine);
        }
    });
    
    // Set up Leaflet.Draw editable group and draw toolbar
    var editLayers = L.featureGroup();
    map.addLayer(editLayers);
    var drawControl = new L.Control.Draw({
        edit: {
            featureGroup: editLayers, // allow editing/deleting of features in this group
            edit: false, // disable the edit tool (since we are doing editing ourselves)
            remove: false
        },
        draw: {
            featureGroup: editLayers,
            circlemarker: false,
            polygon: false,
            circle: false,
            rectangle: false,
            polyline: {shapeOptions: {color: '#f50505', opacity: 1, weight: 3}},
            marker: { icon: redlinePointIcon }
        }
    }).addTo(map);
    
    // Set draw listener on map, call post feature handler
    map.on(L.Draw.Event.CREATED, function(e, feature) {
        var type = e.layerType;
        var layer = e.layer;
        if (type === 'marker') {
            postNewFeature(layer, redlinePoint);
        } else if (type === 'polyline') {
            postNewFeature(layer, redlineLine);
        }
        layer.addTo(map).openPopup();
    });
    
    // When new features posted to feature service, clear L.Draw layergroup
    redlinePoint.on('load', function() {
        editLayers.clearLayers();
    });
    redlineLine.on('load', function() {
        editLayers.clearLayers();
    });
    
    // Bind popups to pipes and structures layers
    pipes.bindPopup(function(layer) {
        var insDate = new Date(layer.feature.properties.InsDate);
        insDate = insDate.toLocaleDateString('en-US');
        return L.Util.template(pipePopup(insDate), layer.feature.properties);
    });
    structures.bindPopup(function(layer) {
        return L.Util.template(strucPopup(), layer.feature.properties);
    });
    
    // Initialize and customize accordion legend control
    var legend = new L.Control.AccordionLegend({
        position: 'topright',
        content: legendContent(pipes, structures, over3Years, under3Years, under1Year, under1Month, redlinePoint, redlineLine),
    }).addTo(map);
    legend.toggleLayer('Pipes', 'on');
    legend.toggleLayer('Point', 'on');
    legend.toggleLayer('Line', 'on');
    
    // Tinker with accordion legend classes for my use case (could have modified source, but hey jQuery)
    $('.leaflet-control-accordionlegend-button').prop('title', 'Toggle layers and view legend items')
    $('.leaflet-control-accordionlegend-button').addClass('w3-button');
    $('.accordionlegend-section-title').addClass('w3-button w3-round');
    $('.accordionlegend-slider').hide();
    $('.accordionlegend-section').children().eq(1).children().eq(1).css('margin-bottom', '0em');
    for (var i=2; i < 8; i++) {
        $('.accordionlegend-section').children().eq(i).children().eq(1).remove();
        if (i==6) { $('.accordionlegend-section').children().eq(6).children().children().eq(2).css('margin-left', '0.43em'); }
        if (i==7) { $('.accordionlegend-section').children().eq(i).css('padding-bottom', '0.7em'); }
    }

    // Turn custom html controls into Leaflet controls
    htmlControlToLeafletControl(map, 'topleft', 'basemap-selector');
    htmlControlToLeafletControl(map, 'topleft', 'street-view');
}
// End of createMap()

// Post new point or line feature to feature services - need to initialize json with properties
// For some reason listener on standard L.Popup not working, needed custom div element
function postNewFeature(layer, redlineLayer) {
    var myPopup = L.DomUtil.create('div', 'popup-create');
    var marker = layer.bindPopup(myPopup);
    myPopup.innerHTML = newRedlinePopup();
    $('#button-submit', myPopup).on('click', function() {
        console.log(layer);
        var feature = layer.feature = layer.feature || {};
        feature.type = 'Feature';
        feature.properties = feature.properties || {};
        feature.properties['name'] = L.DomUtil.get('input-name').value;
        feature.properties['date'] = L.DomUtil.get('input-date').value;
        feature.properties['comments'] = L.DomUtil.get('input-comment').value;
        redlineLayer.addFeature(layer.toGeoJSON());
        layer.closePopup();
    });
}

// Custom popup form EDIT handler for attribute display and post back to feature service
function attributeEditPopup(feature, layer, redlineLayer) {
    var marker = layer.bindPopup(function(layer) {
        return L.Util.template(existingRedlinePopup(), layer.feature.properties);
    });
    marker.on('click', function(e) {
        var layer = this.feature;
        var featureID = layer.properties.OBJECTID;
        var inputName = L.DomUtil.get('input-name');
        var inputDate = L.DomUtil.get('input-date');
        var inputComment = L.DomUtil.get('input-comment');
        var buttonSubmit = L.DomUtil.get('button-submit');
        L.DomEvent.addListener(buttonSubmit, 'click', function(e) {
            layer.properties.name = inputName.value;
            layer.properties.date = inputDate.value;
            layer.properties.comments = inputComment.value;
            redlineLayer.updateFeature({
                type: 'Feature',
                id: featureID,
                geometry: layer.geometry,
                properties: layer.properties
            }, function (error, response) {
                if (error) {
                    console.error(error);
                }
            });
            marker.closePopup();
        });
    });
}

// Set up cursor toggle for Google Street View tool
var map = $('#map');
$('#street-view').on('click', function() {
    if (map.css('cursor') == 'crosshair') {
        map.css('cursor', 'pointer');
        streetViewActive = false;
    } else {
        map.css('cursor', 'crosshair');
        streetViewActive = true;
    }
});

// Open Google Street View in new tab at clicked location
function googleStreet(e) {
    var url = 'https://maps.google.com/maps?q=&layer=c&cbll=' + e.latlng.lat + ',' + e.latlng.lng
    window.open(url);
    map.css('cursor', 'pointer');
    streetViewActive = false;
}

// Main pipe symbology - unique categories
function pipeSymbology(feature) {
    var c;
    var o = 0.75;
    switch (feature.properties.CNG_TYPE_C) {
        case 'Storm Line':
            c = '#7532a8';
            break;
        case 'Open Ditch/Channel':
            c = '#f2950a';
            break;
    }
    return { color: c, opacity: o, weight: 5 };
}

// Pipe Inspection symbology - single value based on inspection flag field
function pipeInspectionOver3YearsSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag3) {
        case 1:
            c = '#e31a1c';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspectionUnder3YearsSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag3_1) {
        case 1:
            c = '#fd8d3c';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspectionUnder1YearSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag1) {
        case 1:
            c = '#c2e699';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspection1MonthSymbology(feature) {
    var c;
    switch (feature.properties.MonthFlag) {
        case 1:
            c = '#238443';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

// Structure symbology - unique categories with picture symbols
function structureIcons(feature) {
    var icon;
    var drainIcon = L.icon({ iconUrl: './img/drain.png', iconSize: [18, 18] });
    var mhIcon = L.icon({ iconUrl: './img/manhole.png', iconSize: [18, 18] });
    var disIcon = L.icon({ iconUrl: './img/discharge.png', iconSize: [18, 18] });
    if (feature.properties.SNG_TYPE_C == 'Storm Manhole') icon = mhIcon;
    else if (feature.properties.SNG_TYPE_C == 'Catch Basin') icon = drainIcon;
    else if (feature.properties.SNG_TYPE_C == 'End of Pipe') icon = disIcon;
    return icon;
}

// Format structure popup information
function strucPopup() {
    return '<h5>{SNG_TYPE_C}</h5>\
            <p>Structure ID: {SNG_ST_NO}<br />\
            Cover: {SNG_COVR_C}<br />\
            Rim Elevation (ft): {SNG_RIM_EL}<br />\
            Depth (ft): {SNG_DEPTH}</p>';
}

// Format pipe popup information
function pipePopup(insDate) {
    return '<h5>{CNG_TYPE_C}</h5>\
            <p>Pipe ID: {CNG_NUMBER}<br />\
            US Structure ID: {CNG_US_STR}<br />\
            DS Structure ID: {CNG_DS_STR}<br />\
            Material: {CNG_MATR_C}<br />\
            Diameter (ft): {CNG_DIA}<br />\
            Length (ft): {CNG_LENGTH}<br />\
            Owner: {CNG_OWN_CD}<br />\
            Inspection Date: ' + insDate + '</p>';
}

// Format new redline popup form
function newRedlinePopup() {
    var newRedlinePopupTemplate =
        '<form id="popup-form" class="w3-container">\
            <h4>Create New Feature</h4>\
            <label><b>Name</b></label>\
            <input id="input-name" class="w3-input w3-border" type="text">\
            <p>\
            <label><b>Date</b></label>\
            <input id="input-date" class="w3-input w3-border" type="text"></p>\
            <p>\
            <label><b>Comments</b></label>\
            <input id="input-comment" class="w3-input w3-border" type="text"></p>\
            <p>\
            <button id="button-submit" class="w3-btn w3-light-grey w3-round w3-margin-top" type="button">Save</button></p>\
        </form>'
    return newRedlinePopupTemplate;
}

// Format existing redline popup form
function existingRedlinePopup() {
    var existingRedlinePopupTemplate =
        '<form id="popup-form" class="w3-container">\
            <h4>Edit Existing Feature</h4>\
            <label><b>Name</b></label>\
            <input id="input-name" class="w3-input w3-border" type="text" value="{name}">\
            <p>\
            <label><b>Date</b></label>\
            <input id="input-date" class="w3-input w3-border" type="text" value="{date}"></p>\
            <p>\
            <label><b>Comments</b></label>\
            <input id="input-comment" class="w3-input w3-border" type="text" value="{comments}"></p>\
            <p>\
            <button id="button-submit" class="w3-btn w3-light-grey w3-round w3-margin-top" type="button">Save</button></p>\
        </form>'
    return existingRedlinePopupTemplate;
}

// Html element to custom Leaflet control
function htmlControlToLeafletControl(map, position, element, action) {
    var NewControl = L.Control.extend({
        options: {
            position: position
        },
        onAdd: function() {
            var newControl = L.DomUtil.get(element);
            return newControl;
        }
    });
    map.addControl(new NewControl());
}

// Change cursor to pointer over custom controls for consistency
$('#basemap-selector').hover(function() {
    $(this).css('cursor', 'pointer');
});
$('#street-view').hover(function() {
    $(this).css('cursor', 'pointer');
});

// Disable pan/zoom interactions on custom controls
$('.custom-control, .legend-control-container').on('mousedown dblclick click', function(e) {
   L.DomEvent.stopPropagation(e); 
});

// Build legend object for accordion legend plugin
function legendContent(pipes, structures, over3Years, under3Years, under1Year, under1Month, redlinePoint, redlineLine) {
    var content = 
    [
        {
            'title': "Storm Infrastructure",
            layers: [
                {
                    'title': "Structures",
                    'layer': structures,
                    'legend': [
                        { 'type':'image', 'url':'img/manhole.png', 'text':"Manhole" },
                        { 'type':'image', 'url':'img/drain.png', 'text':"Catch Basin" },
                        { 'type':'image', 'url':'img/discharge.png', 'text':"End of Pipe" }
                    ]
                },
                {
                    'title': "Pipes",
                    'layer': pipes,
                    'legend': [
                        { 'type':'line', 'color':'#7532a8', 'text':"Storm Line" },
                        { 'type':'line', 'color':'#f2950a', 'text':"Open Ditch" }
                    ]
                }

            ]
        },
        {
            'title': "Pipe Inspections",
            layers: [
                {
                    'title': "Over 3 Years",
                    'layer': over3Years,
                    'legend': [
                        { 'type':'line', 'color':'#e31a1c', 'text':"" }
                    ]
                },
                {
                    'title': "Under 3 Years, Over 1 Year",
                    'layer': under3Years,
                    'legend': [
                        { 'type':'line', 'color':'#fd8d3c', 'text':"" }
                    ]
                },
                {
                    'title': "Under 1 Year, Over 1 Month",
                    'layer': under1Year,
                    'legend': [
                        { 'type':'line', 'color':'#78c679', 'text':"" }
                    ]
                },
                {
                    'title': "Within Last Month",
                    'layer': under1Month,
                    'legend': [
                        { 'type':'line', 'color':'#238443', 'text':"" }
                    ]
                }
            ]
        },
        {
            'title': "Redlines",
            layers: [
                {
                    'title': "Point",
                    'layer': redlinePoint,
                    'legend': [
                        { 'type':'circle', 'color':'#f50505', 'text':"" }
                    ]
                },
                {
                    'title': "Line",
                    'layer': redlineLine,
                    'legend': [
                        { 'type':'line', 'color':'#f50505', 'text':"" }
                    ]
                }
            ]
        }
    ]
    return content;
}

$(document).ready(createMap);