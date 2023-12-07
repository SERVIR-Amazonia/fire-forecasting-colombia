// -------------------------------------------------------------------------------
// SERVIR-Amazonia - Fire Forecasting in the Colombian Amazon JFM 2023
// Authors: Michael Bell (University of Arkansas)
//          Andréa Puzzi Nicolau (Spatial Informatics Group)
// Description: Script to train MaxEnt model using 2021 OND 
//              predictors and 2022 JFM predictands and apply it to
//              2022 OND predictors for 2023 JFM forecast.
// -------------------------------------------------------------------------------

// ------- Input Variables ------------
/***
PR        = Precipitación total (m) 
Protected = Areas protegidas - Cobertura por pixel (%)
SOIL1     = Volumen de agua en suelo (m3/m3; 0-7 cm in depth)
T2M       = Temperatura superficial del suelo - 2m (°K)
GLAD      = Alertas de perdida forestal (conteos)
VPD       = Deficit de presión de vapor (hPa)
*/

// Predictores - Variables ambientales - OND 2021.
var PR = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/PR_ERA5_avg_ColombianAmazon_0p25deg_OND2021_p");
var Protected = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/Percentage_ProtectedAreas_0p25deg_ColombianAmazon");
var SOIL1 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/SOILW1_ERA5_avg_ColombianAmazon_0p25deg_OND2021_p");
var T2M = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/T2M_ERA5_avg_ColombianAmazon_0p25deg_OND2021_p");
var GLAD = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/GLAD_Alert_sum_ColombianAmazon_ERA5_Col2_0p25deg_OND2021");
var VPD = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2021/VPD_ERA5_avg_ColombianAmazon_0p25deg_OND2021");

// Crear nueva imagen conteniendo todas las variables en bandas respectivas.
var newBands = ee.Image([PR, Protected, SOIL1, T2M, GLAD, VPD]);

// Predictores - Variables ambientales - OND 2022.
var PR_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/PR_ERA5_avg_ColombianAmazon_0p25deg_OND2022_p");
var Protected_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/Percentage_ProtectedAreas_0p25deg_ColombianAmazon");
var SOIL1_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/SOILW1_ERA5_avg_ColombianAmazon_0p25deg_OND2022_p");
var T2M_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/T2M_ERA5_avg_ColombianAmazon_0p25deg_OND2022_p");
var GLAD_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/GLAD_Alert_sum_ColombianAmazon_ERA5_Col2_0p25deg_OND2022");
var VPD_22 = ee.Image("projects/fire-colombia/assets/inputs/ERA5_Predictors_OND2022/VPD_ERA5_avg_ColombianAmazon_0p25deg_OND2022");

// Crear nueva imagen conteniendo todas las variables en bandas respectivas.
var newBands_22 = ee.Image([PR_22, Protected_22, SOIL1_22, T2M_22, GLAD_22, VPD_22]);


// ------- AOI ------------

// Importar poligono de Amazonia Colombiana.
var geom = ee.FeatureCollection('projects/fire-colombia/assets/aoi/colombian_amazon');

// Centrar the map.
Map.centerObject(geom, 6);


// ------- Datos de entrenamiento ------------

// JFM 2022 Predictands: presencia de incendios.
var presenceData = ee.FeatureCollection('users/retsalp/VIIRS_Suomi_Occurrences_UT_1222thresh_ColombianAmazon_0p25deg_JFM2022_maxent');

// Verificar numero de puntos
print('Number of presence points', presenceData.size());

// Obtener proyeccion de predictores.
var projection = newBands.projection();

// Crear grilla 
//Create grid using the image's projection to then sample absence points at pixel centroids.
// var displayGrid = function(proj) {
//   // Scale by 2 because we have 2 zero crossings when using round.
//   var cells = ee.Image.pixelCoordinates(proj.scale(2,2));
//   return cells.subtract(cells.round()).zeroCrossing().reduce('sum').selfMask();
// }; 

// Tomar puntos de cada pixel (500 puntos).
var absenceData = newBands.select('PR').addBands(ee.Image.pixelLonLat())
  .sample({
    region: geom,
    projection: projection,
    numPixels: 500,
    tileScale: 8,
    seed: 7
  });

// Crear datos de ausencia de puntos muestreados.
absenceData = absenceData.map(function(f) {
  return f.setGeometry(ee.Geometry.Point([f.getNumber('longitude'), f.getNumber('latitude')]))
          .set('presence', 0);
});
print('Number of absence points', absenceData.size());

// Usar filtro espacial, para evitar tomar puntos de ausencia
// dentro de la misma area donde hay puntos de presencia.
var distFilter = ee.Filter.withinDistance({
    distance: 25000,
    leftField: '.geo',
    rightField: '.geo',
    maxError: 10
});

// Regresar solo elementos de la colección 1 que no estan en el rango
// de area de elementos de la coleccion 2.
var join = ee.Join.inverted();
var absenceData = join.apply(absenceData, presenceData, distFilter);
print('Number of absence points after join', absenceData.size());

// Crear puntos de entrenamiento (presence+absence).
var trainingData = presenceData.merge(absenceData);
print('Total number of training points', trainingData.size());

// Añadir puntos de entrenamiento al mapa.
Map.addLayer(
    trainingData.filter(ee.Filter.eq('presence', 1)), {color: 'yellow'},
    'Fire presence locations JFM 2022', false);

Map.addLayer(
    trainingData.filter(ee.Filter.eq('presence', 0)), {color: 'bc8f8f'},
    'Fire absence - randomly generated', false);

// Muestrear predictores (bandas) en puntos de entrenamiento.
var training = newBands.sampleRegions(
  {collection: trainingData,
    properties: ['presence']
  });

// ------- MaxEnt Model ------------

// Definir bandas de prediccion.
var predictionBands = ['PR', 'SOIL1', 'Protected', 'T2M', 'GLAD', 'VPD'];

// Definir clasificador y entrenarlo con los predictores de OND 2021.
var classifier = ee.Classifier.amnhMaxent({hinge: false, 
autoFeature: false }).train({
  features: training,
  classProperty: 'presence',
  inputProperties: predictionBands,
});

// Print the classifier to get a sense of most important variables.
print('Classifier Explained', classifier.explain());

// Aplicar modelo a predictores de OND 2022.
var imageClassified = newBands_22.classify(classifier);

// ------- Resultado de predicción ------------

// Crear paleta de colores.
var palettes = require('users/gena/packages:palettes');
var palette = palettes.colorbrewer.Spectral[11].reverse();
var vis = {bands: 'probability', min: 0, max: 1, palette: palette};

// Añadir capa de probabilidad de incendios al mapa.
Map.addLayer(imageClassified, vis, 'Probability');

// ------- Exportar ------------

// Export the fire probability image for the Colombian Amazon to your
// Google Drive as a GeoTIFF file.
Export.image.toDrive({
  image: imageClassified,
  description: 'Fire_suit_prob_JFM2023_ERA5_MaxEnt_GACol2_train_envOND21_fireJFM22_fcst_envOND22',
  region: geom,
  crs: 'EPSG:4326',
  dimensions: "49 x 42",
  fileFormat: 'GeoTIFF'
});
