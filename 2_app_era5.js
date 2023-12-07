// SERVIR-Amazonia - APP: Fire Forecasting in the Colombian Amazon JFM 2023
// Authors: Andréa Puzzi Nicolau (Spatial Informatics Group)
// Description: Script to create Fire Forecasting app.
// -------------------------------------------------------------------------------

/*
 * Map layer configuration
 */

// Features: Country boundaries
var colombiaStates = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level1")
.filter(ee.Filter.eq('ADM0_NAME', 'Colombia'));

var empty = ee.Image().byte();

var outline = empty.paint({
  featureCollection: colombiaStates,
  color: 0,
  width: 1
});

// Layer of Departamentos.
var states = ui.Map.Layer(outline, {palette: 'FFFFFF'}).setName('Departamentos');

// Image: Fire prediction JFM 2023
var image = ee.Image('projects/fire-colombia/assets/outputs/Fire_suit_prob_JFM2023_ERA5_MaxEnt_GACol2_train_envOND21_fireJFM22_fcst_envOND22');

// Color palettes
var palettes = require('users/gena/packages:palettes');
var palette = palettes.colorbrewer.Spectral[11].reverse();
var vis = {bands: 'probability', min: 0, max: 1, palette: palette};

// Layer of fire prediction.
var layer = ui.Map.Layer(image, vis).setName('Aptitud Enero-Marzo 2023');

// Create the main map and add existing layers.
var mapPanel = ui.Map();
var layers = mapPanel.layers();
layers.add(layer, 'Aptitud Enero-Marzo 2023');
layers.add(states, 'Estados');


/*
 * Panel setup
 */

// Create a panel to hold title, intro text, chart and legend components.
var inspectorPanel = ui.Panel({style: {width: '25%'}});

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'Predicción de incendios: Enero-Marzo 2023',
    style: {fontSize: '28px', fontWeight: 'bold'}
  }),
  ui.Label('Haga un click en un punto para saber la probabilidad (%) de incendios en Enero, Febrero y Marzo de 2023.')
]);

// add subpanel
inspectorPanel.add(intro);

// Create panels to hold lon/lat values.
var lon = ui.Label();
var lat = ui.Label();
inspectorPanel.add(ui.Panel([lon, lat], ui.Panel.Layout.flow('horizontal')));

// Add placeholders for the chart and legend.
inspectorPanel.add(ui.Label('[Chart]'));
inspectorPanel.add(ui.Label('[Legend]'));

/*
LL: SPECIFIC DETAILS OF THE DESCRIPTIONS BELOW CAN BE MENTIONED IN THE GITHUB DOCUMENTATION PAGE,
TO RELEASE SPACE IN THE PANEL.
*/

var description = ui.Panel([
  ui.Label({
    value: 'Descripción',
    style: {fontSize: '10px', fontWeight: 'bold'}
  }),
  ui.Label({
    value: 'Esta interfaz muestra una predicción de aptitud para incendios como una '+
           'probabilidad durante la temporada de enero a marzo de 2023 a una resolución '+
           'espacial de 0,25° lat/lon en la Amazonía colombiana. El clasificador de '+
           'máxima entropía (MaxEnt; Phillips et al. 2004) implementado en Google Earth '+
           'Engine fue utilizado para entrenar un modelo con ubicaciones de incendios '+
           'conocidas en enero-marzo de 2022 y variables predictoras ambientales de la '+
           'temporada anterior de octubre-diciembre de 2021. A partir de este modelo '+
           'entrenado se han utilizado las mismas variables ambientales en la temporada '+
           'octubre-diciembre 2022 para predecir la probabilidad de incendios en la '+
           'temporada enero-marzo 2023. La distribución modelada de probabilidades de '+
           'incendio en la región está restringida por funciones lineales, de producto '+
           'y cuadráticas de las variables predictoras, y se usa una función de “cloglog” '+
           'para escalar los valores finales de probabilidad.',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: 'Las variables ambientales utilizadas aquí como predictores, para cada '+
           'cuadrícula de 0,25° de latitud/longitud, se calculan a partir del reanálisis '+
           'de ERA5 de las variables promedio mensuales (Hersbach et al. 2019), que incluyen:',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• Promedio de octubre a diciembre de la precipitación media mensual (m)',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• Promedio de octubre a diciembre de la temperatura media mensual a 2 metros (K)',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• Promedio de octubre a diciembre de la capa 1 de humedad volumétrica media '+
           'mensual del suelo (0-7 cm de profundidad; m3/m3)',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• Promedio de octubre a diciembre del déficit de presión de vapor (hPa), '+
           'derivado por hora, del reanálisis ERA5 de temperatura a 2 metros y temperatura '+
           'de punto de rocío a 2 metros (Hersbach et al. 2018)',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• La fracción de cada cuadrícula que contiene áreas protegidas en Colombia, '+
           'derivada de archivos Protected Planet (UNEP-WCMC y UICN 2022)',
    style: {fontSize: '10px'}
  }),
  ui.Label({
    value: '• La suma de octubre a diciembre para cada cuadrícula de 0,25° lat./long. de '+
           'GLAD Forest Loss Alerts con una resolución de 0,00025° lat./lon. basada en '+
           'datos de Landsat Collection 2 (Hansen et al. 2016)',
    style: {fontSize: '10px'}
  }),  
  ui.Label({
    value: 'Los datos de presencia de incendios utilizados para entrenar el modelo se '+
           'derivan de VIIRS Suomi NPP de 375 m de resolución nominal y detecciones de '+
           'incendios activos de alta confianza (Schroeder et al. 2014) obtenidos del '+
           'sitio web de NASA FIRMS. Los recuadros de cuadrícula de 0,25° latitud/longitud '+
           'en los que la suma de las detecciones de incendios activas para la temporada '+
           'de enero a marzo de 2022 estuvo en el tercil superior de la distribución '+
           'histórica de enero a marzo de 2012-2022 se designaron como cuadrícula de '+
           'presencia de incendios.',
    style: {fontSize: '10px'}
  })
]);

inspectorPanel.add(description, ui.Panel.Layout.flow('horizontal'));

/*
 * Chart setup
 */

// Fetches probability for the given coordinates.
var generateChart = function (coords) {
  // Update the lon/lat panel with values from the click event.
  lon.setValue('lon: ' + coords.lon.toFixed(2));
  lat.setValue('lat: ' + coords.lat.toFixed(2));

  // Add a dot for the point clicked on.
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  var dot = ui.Map.Layer(point, {color: '000000'}, 'Punto seleccionado');
  // Add the dot as the second layer, so it shows up on top of the composite.
  mapPanel.layers().set(2, dot);
  //Scale must be small e.g. 10m, instead of 27000m, caused it would take values from neighbour pixels.
  var prevision = image.reduceRegion(ee.Reducer.first(), point, 10).evaluate(function(val){
    var prevText = 'Aptitud punto seleccionado (%): ' + ee.Number(val.probability).multiply(100).round().getInfo();
    inspectorPanel.widgets().set(2, ui.Label(prevText));
  });
};


/*
 * Legend setup
 */

// Creates a color bar thumbnail image for use in legend from the given color
// palette.
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(vis.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});

// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(vis.min, {margin: '4px 8px'}),
    ui.Label(
        (vis.max / 2 * 100),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(vis.max * 100, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
  value: 'Leyenda Mapa: Aptitud para incendios (%)',
  style: {fontWeight: 'bold'}
});

var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);
inspectorPanel.widgets().set(3, legendPanel);

/*
 * Map setup
 */

// Satellite basemap
mapPanel.setOptions('SATELLITE');

// Register a callback on the default map to be invoked when the map is clicked.
mapPanel.onClick(generateChart);

// Configure the map.
mapPanel.style().set('cursor', 'crosshair');


// Initialize with a test point.
var initialPoint = ee.Geometry.Point(-71.575, 0.853);
mapPanel.centerObject(colombiaStates, 6);


/*
 * Initialize the app
 */

// Replace the root with a SplitPanel that contains the inspector and map.
ui.root.clear();
ui.root.add(ui.SplitPanel(inspectorPanel, mapPanel));

generateChart({
  lon: initialPoint.coordinates().get(0).getInfo(),
  lat: initialPoint.coordinates().get(1).getInfo()
});
