
/* ---------- Toggle options ------------ */
function toggle(event){
  var id = event.target.id;
  var op;
  op = $(event.target).is(":checked") ? "show" : "hide";
  $(".toggle-"+id)[op]();
}
$(".toggle").change(toggle);
$(".toggle").click(toggle);

/* ---------- Status messages ------------ */

function setStatus(msg, options) {
  $("#status-msg").text(msg);
  var statusclass = options && options.class ? options.class : "status-info";
  $("#status-msg").attr("class", statusclass);
  $("#status").fadeIn();
  if (options && options.timeout) {
    setTimeout(function () {
      clearStatus();
    }, 1000 * options.timeout);
  }
}

function clearStatus() {
  $("#status").fadeOut(800);
}

/* ---------- Property file loading ------------ */

function handleFileSelect(event) {
  saveConfig();
  var file = event.target.files[0]; // File object
  var reader = new FileReader();
  reader.onload = function (event) {
    parseProperties(this.result, file.name);
  };
  reader.onerror = function (err) {
    setStatus("File loading failed: " + err, {
      class: "status-error",
      timeout: 3
    });
  }
  // Read in the image file as a data URL.
  reader.readAsText(file);
}
$("#file").change(handleFileSelect);


/* ---------- Property URL loading ------------ */

function fetchFromURL(event) {
  saveConfig();
  var url = config.fetchURL;
  var getOptions = {};
  if (config.fetchAuth) {
    getOptions.username = config.fetchUser;
    getOptions.password = getFetchPassword();
  }
  $.get(url, getOptions)
  .done(function (data) {
    parseProperties(data, url.substring(url.lastIndexOf("/") + 1));
  })
  .fail(function () {
    setStatus("File loading failed: " + err, {
      class: "status-error",
      timeout: 3
    });
  });
}
$("#fetch").click(fetchFromURL);


/* ---------- Property file display ------------ */


function deleteProperties() {
  $("#tprops").empty();
  $("#pname").text("");
  $("#output").empty();
  $("#file").val("");
}

function clearProperties() {
  $("#tprops tr").each(function (idx) {
    $(this).find("input[type=checkbox]").prop('checked', true);
    $(this).find("input[type=text]").val("");
  });
}

function parseProperties(properties, name) {
  deleteProperties();
  if (name) {
    var slash = name.lastIndexOf("/");
    var dot = name.lastIndexOf(".");
    if (dot <= 0) {
      dot = undefined;
    }
    name = name.substring(slash + 1, dot);
    $("#pname").text(name);
  }
  var desc;
  var lines = properties.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // spaces at beggining of line are ignored
    var line = lines[i].trimLeft();
    while (line.endsWith("\\")) {
      line = line.substring(0, line.length - 1);
      if (i+1 < lines.length) {
        line += lines[++i].trimLeft();
      }
    }
    // assignment can be '=' or ':'
    var eq = line.indexOf("=");
    var col = line.indexOf(":");
    var sep = col > 0 ? ((eq > 0) ? Math.min(eq, col) : col) : eq;
    // comment can start with '#' or '!'
    if (line.startsWith("#") || line.startsWith("!")) {
      // comment line
      desc = line.substring(1);
    } else if (sep > 0) {
      // looks like <key,value> pair
      var vname = line.substring(0, sep).trimRight();
      var val= line.substring(sep + 1).trimLeft(); // white spaces at end of line are part of value
      if (config.vtrimr) {
        val = val.trimRight();
      }
      if (vname) {
        addProperty(vname, val, desc);
      }
      desc = undefined;
    } else if (line.trim()) {
      // non empty line and invalid
      setStatus("Syntax error, line " + (i + 1) + ": " + line, {
        class: "status-error",
        timeout: 3
      });
      return;
    } else {
      // ignore empty lines
      desc = undefined;
    }
  }
}

function addProperty(name, value, desc) {
  var input = "<input type='text' value='" + value + "'/>";
  if (desc) {
    input += "<br/><span>" + desc + "</span>";
  }
  $("#tprops").append("<tr>"
  + "<td><input type='checkbox' checked/></td>"
  + "<td>"+ name + "</td>"
  + "<td>" + input + "</td>"
  + "</tr>");
  var addedRow = $("#tprops tr:last-child");

  $(addedRow).find("input[type=checkbox]").change(function(event) {
    var nameCell = addedRow.find("td:nth-child(2)");
    var input = addedRow.find("td:nth-child(3) input");
    if ($(event.target).is(":checked")) {
      nameCell.removeClass("disabled");
      input.prop("readonly", false);
      input.prop("disabled", false);
    } else {
      nameCell.addClass("disabled");
      input.prop("readonly", true);
      input.prop("disabled", true);
    }
  })
}

$("#clear-form").click(clearProperties);
$("#delete-form").click(deleteProperties);

/* ---------- Property file data collection ------------ */

function getProperties() {
  var properties = "";
  properties += "## Generated by " + window.location + "\n";
  properties += "## Date: " + new Date().toISOString() + "\n\n";
  $("#tprops tr").each(function (idx) {
    var isIncluded = $(this).find("input[type=checkbox]").is(":checked");
    if (isIncluded) {
      var name = $(this).find("td:first").text().trim();
      var value = $(this).find("input[type=text]").val().trimLeft();
      if (config.vtrimr) {
        value = value.trimRight();
      }
      var desc = $(this).find("span").text().trim();
      if (desc) {
        properties += "# " + desc + "\n";
      }
      properties += name + "=" + value + "\n";
    }
  });
  return properties;
}

function getName() {
  return $("#pname").text();
}
$("#pname-edit").click(function () {
  var oldname = $("#pname").text();
  if (oldname) {
    var newname = prompt("Change property file name:", oldname);
    if (newname) {
      $("#pname").text(newname);
    }
  }
});

/* ---------- Property file saving ------------ */

function download(filename, text) {
  var pom = document.createElement('a');
  pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  pom.setAttribute('download', filename);

  if (document.createEvent) {
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  } else {
    pom.click();
  }
}

$("#save").click(function () {
  saveConfig();
  download(getName() + ".properties", getProperties());
});

/* ---------- Property file posting ------------ */

function friendpasteUpload(name, data, onDone, onFail) {
  var postOptions = {
    method: "POST",
    url: config.postUrl,
    dataType: "json",
    contentType: "application/json; charset=utf-8",
    data: JSON.stringify({
      "title": name,
      "snippet": data,
      "password": "dummy",
      "language": "text"
    })
  };
  if (config.postAuth) {
    postOptions.username = config.postUser;
    postOptions.password = getPostPassword();
  }
  $.ajax(postOptions).done(function (resp) {
    if (resp.ok) {
      onDone(resp.url + "?rev=" + resp.rev, resp.url + "/raw?rev=" + resp.rev);
    } else {
      onFail(resp.reason);
    }
  }).fail(onFail);
}

$("#post").click(function () {
  saveConfig();
  if (localStorage.getItem("nopost")) {
    onPostDone(undefined, "https://friendpaste.com/2P0OaZhUfBH2mfWJzYkIZb/raw?rev=393530653965");
    return;
  }
  friendpasteUpload(getName(), getProperties(), onPostDone, onPostFailed);
});

function onPostDone(viewurl, rawurl) {
  var output = $("#output");
  output.empty();
  output.html("<div><input type='text' id='output-url' readonly='readonly' value='" + rawurl + "'/></div>" +
    "<img src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=>" + encodeURIComponent(rawurl) + "'/>");

  $("#output-url").click(function(event) {
    event.target.select();
    event.target.setSelectionRange(0, 99999); /*For mobile devices*/
    /* Copy the text inside the text field */
    document.execCommand("copy");
    setStatus("URL copied!", { timeout: 2});
  });
}

function onPostFailed(err) {
  setStatus("File upload failed: " + err, {
    class: "status-error",
    timeout: 2
  });
}

/* ---------- Config -------------*/

var DEFAULT_CONFIG = {
  encrypt: false,
  encryptIter: $("#encrypt-iter option:first-child").val(),
  encryptAlgo: $("#encrypt-alg option:first-child").val(),
  encryptKsz: $("#encrypt-ksz option:first-child").val(),
  vtrimr: false,
  fetchAuth: false,
  postUrl: "https://www.friendpaste.com",
  postAuth: false
}
var CONFIG_ITEM = "properties-editor.config";

var config = JSON.parse(localStorage.getItem(CONFIG_ITEM)) || DEFAULT_CONFIG;

function saveConfig() {
  config.fetchUrl = $("#fetch-url").val().trim();
  config.fetchAuth = $("#fetch-auth").is(":checked");
  config.fetchUser = $("#fetch-user").val().trim();

  config.vtrimr = $("#vtrimr").is(":checked");

  config.encrypt = $("#encrypt").is(":checked");
  config.encryptSalt = $("#encrypt-salt").val().trim();
  config.encryptIter = $("#encrypt-iter").val();
  config.encryptAlgo = $("#encrypt-alg").val();
  config.encryptKsz = $("#encrypt-ksz").val();

  config.postUrl = $("#post-url").val().trim();
  config.postAuth = $("#post-auth").is(":checked");
  config.postUser = $("#post-user").val().trim();

  localStorage.setItem(CONFIG_ITEM, JSON.stringify(config))
}

function applyConfig() {
  $("#fetch-url").val(config.fetchUrl);
  $("#fetch-auth").prop("checked", config.fetchAuth);
  config.fetchAuth && $(".toggle-fetch-auth").show();
  $("#fetch-user").val(config.fetchUser);

  $("#vtrimr").prop("checked", config.vtrimr);

  $("#encrypt").prop("checked", config.encrypt);
  config.encrypt && $(".toggle-encrypt").show();
  $("#encrypt-salt").val(config.encryptSalt);
  $("#encrypt-iter").val(config.encryptIter);
  $("#encrypt-alg").val(config.encryptAlgo);
  $("#encrypt-ksz").val(config.encryptKsz);

  $("#post-url").val(config.postUrl)
  $("#post-auth").prop("checked", config.postAuth);
  config.postAuth && $(".toggle-post-auth").show();
  $("#post-user").val(config.postUser);
}

function getFetchPassword() {
  return $("#fetch-password").val().trim();
}
function getPostPassword() {
  return $("#post-password").val().trim();
}
function getEncryptPassword() {
  return $("#encrypt-password").val().trim();
}

$("#resetCfg").click(function() {
  config = DEFAULT_CONFIG;
  applyConfig();
  $("input[type=password]").val("");
  $("input[type=checkbox]").change();
  saveConfig();
});

$(window).on("load", function() {

  applyConfig();

  $(window).on("unload", function() {
    saveConfig();
  });
});

/* ---------- Test -------------*/

function test() {
  parseProperties(`
### Header

# This is a URL
 test = https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=

    # ignored comment

name=this is a dummy string aàçuù

   ! multiline comment sarting with !
 multiline  = line1   \\
    line2 \\
line3

# this a \\
  multiline \\
  comment with ':' assignment
equation.1 : 9879=879

`, "just testing");
}

test();
