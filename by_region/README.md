# Motion Chart
<a href="http://www.youtube.com/watch?feature=player_embedded&v=JkpbY08swyA" target="_blank"><img src="http://img.youtube.com/vi/JkpbY08swyA/0.jpg" alt="Show video" width="720" height="480" border="10" /></a>
<BR><BR>
(Click on the picture to see the video)
<BR><BR>
Easily create an interactive motion chart from a Pandas Dataframe in Python. Publish the chart to a standalone webpage, show it in Jupyter notebook or save it as a html file
<BR><BR>

**1. Install**<BR>
pip install motionchart
<BR><BR>
**2. Import**<BR>
from motionchart.motionchart import MotionChart, MotionChartDemo<BR>
<BR>
**3. Test**<BR>
MotionChartDemo()<BR>
<BR>
**4. Define your own motion chart** using the columns in a pandas dataframe<BR>
Example: You have a dataframe called fruitdf and want to create a motionchart:<BR>
<BR>
mChart = MotionChart(df = fruitdf)
<BR><BR>
**5. Display the Motion Chart**<BR>
mChart.to_browser()<BR>
or, if using Jupyter notebook<BR>
mChart.to_notebook()
<BR><BR>
see http://socr.ucla.edu/htmls/HTML5/MotionChart/ for a live example
<BR><BR>
See the file "motion chart notebook" (in the notebooks folder above) for more examples and detailed instructions
<BR><BR>
**This is an early version, use at your own risk, the API may change**
Note that the html file producing the (last) chart you show is saved in a file ("smc_temp.html" and in some cases "temp.html"). New files will overwrite old files.
<BR><BR>
See https://github.com/RamyElkest/SocrMotionChartsHTML5 for more information about the javascript that builds the chart<BR>
See also https://github.com/psychemedia/dataviz4development/tree/master/SocrMotionCharts
