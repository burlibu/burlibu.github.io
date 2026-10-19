// CREDIT:
// https://codepen.io/brittrademaker/pen/gJXXJo

$(document).ready(function () {
  var width = 700;
  var height = 700;
  var center = {
    x: width / 2,
    y: height / 2,
  };
  var radius = width / 2;
  var radius2 = radius - 300;
  var count = 44;
  var angle = 0;
  var slice = (Math.PI * 2) / count;
  var point = {
    x: 0,
    x2: 0,
    y: 0,
    y2: 0,
  };
  var i;
  var svg = d3
    .selectAll(".epi-banner-radial")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g");
  for (i = 0; i < count; i += 1) {
    angle = i * slice;
    point.x = center.x + Math.cos(angle) * radius;
    point.x2 = center.x + Math.cos(angle) * radius2;
    point.y = center.y + Math.sin(angle) * radius;
    point.y2 = center.y + Math.sin(angle) * radius2;

    svg
      .append("line")
      .attr("x1", point.x)
      .attr("x2", point.x2)
      .attr("y1", point.y)
      .attr("y2", point.y2);
  }
});

// jQuery Modal Popups by Black
// http://code.jfbs.net/?showtopic=57

$(document).ready(function () {
  var fadeBackground = $(document.createElement("div"))
      .hide()
      .attr("id", "fade-background"),
    modalWindow = $(document.createElement("div"))
      .hide()
      .attr("id", "modal-window");
  $(document.body).append(fadeBackground, modalWindow);
  $(document).on("click", ".modal-link", function (e) {
    $("#fade-background").css({ opacity: "1" }).fadeIn("fast");
    var newContents = $("#" + $(this).data("modal-target")).html();
    $("#modal-window").html(newContents);
    $("#modal-window").fadeIn("fast");
    e.preventDefault();
  });
  $(document).on("click", "#fade-background", function () {
    $("#fade-background").fadeOut("fast");
    $("#modal-window").fadeOut("fast");
  });
  $(document).keypress(function (e) {
    if (e.keyCode == 27) {
      $("#fade-background").fadeOut("fast");
      $("#modal-window").fadeOut("fast");
    }
  });
});
