// Initialize the plugin

// Globally save the current selected window
var g_iWndIndex = 0; // This variable may not be necessary; when window parameters are not passed in interfaces, the SDK will default to the currently selected window.
var g_oLocalConfig = null; // Local configuration

// Error codes
// General errors
var ERROR_CODE_UNKNOWN = 1000; // Unknown error
var ERROR_CODE_NETWORKERROR = 1001; // Network error
var ERROR_CODE_PARAMERROR = 1002; // Missing plugin element

// Login module
var ERROR_CODE_LOGIN_NOLOGIN = 2000; // Not logged in
var ERROR_CODE_LOGIN_REPEATLOGIN = 2001; // Device already logged in; duplicate login
var ERROR_CODE_LOGIN_NOSUPPORT = 2002; // Current device does not support Digest login

// Preview playback
var ERROR_CODE_PLAY_PLUGININITFAIL = 3000; // Plugin initialization failed
var ERROR_CODE_PLAY_NOREPEATPLAY = 3001; // Current window is already in preview
var ERROR_CODE_PLAY_PLAYBACKABNORMAL = 3002; // Playback exception
var ERROR_CODE_PLAY_PLAYBACKSTOP = 3003; // Playback stopped
var ERROR_CODE_PLAY_NOFREESPACE = 3004; // Insufficient disk space during recording

// Intercom
var ERROR_CODE_TALK_FAIL = 5000; // Voice intercom failed


$(function () {
    // Initialize plugin parameters and insert the plugin
    WebVideoCtrl.I_InitPlugin({
        bWndFull: true,     // Whether to support double-click full-screen for a single window; default is true (supported)
        iWndowType: 1,
        // aIframe: ["test"],
        cbSelWnd: function (xmlDoc) {
            g_iWndIndex = parseInt($(xmlDoc).find("SelectWnd").eq(0).text(), 10);
            var szInfo = "Current selected window number: " + g_iWndIndex;
            showCBInfo(szInfo);
        },
        cbDoubleClickWnd: function (iWndIndex, bFullScreen) {
            var szInfo = "Current maximized window number: " + iWndIndex;
            if (!bFullScreen) {
                szInfo = "Current restored window number: " + iWndIndex;
            }
            showCBInfo(szInfo);
        },
        cbEvent: function (iEventType, iParam1, iParam2) {
            if (2 == iEventType) { // Playback ended normally
                showCBInfo("Window " + iParam1 + " playback ended!");
            } else if (-1 == iEventType) {
                showCBInfo("Device " + iParam1 + " network error!");
            } else if (3001 == iEventType) {
                clickStopRecord(g_szRecordType, iParam1);
            }
        },
        cbInitPluginComplete: function () {
            WebVideoCtrl.I_InsertOBJECTPlugin("divPlugin").then(() => {
                // Check if the plugin is up to date
                WebVideoCtrl.I_CheckPluginVersion().then((bFlag) => {
                    if (bFlag) {
                        alert("A new plugin version has been detected. Double-click HCWebSDKPluginsUserSetup.exe in the SDK directory to upgrade!");
                    }
                });
            }, () => {
                alert("Plugin initialization failed. Please confirm if the plugin is installed. If not, double-click HCWebSDKPluginsUserSetup.exe in the SDK directory to install it!");
            });
        }
    });

    // Bind window events
    $(window).bind({
        resize: function () {
            // WebVideoCtrl.I_Resize($("body").width(), $("body").height());
        }
    });

    // Initialize date and time
    var szCurTime = dateFormat(new Date(), "yyyy-MM-dd");
    $("#starttime").val(szCurTime + " 00:00:00");
    $("#endtime").val(szCurTime + " 23:59:59");
    $("#downloadstarttime").val(szCurTime + " 00:00:00");
    $("#downloadendtime").val(szCurTime + " 23:59:59");
});

// Display operation information
function showOPInfo(szInfo, status, xmlDoc) {
    var szTip = "<div>" + dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss") + " " + szInfo;
    if (typeof status != "undefined" && status != 200) {
        var szStatusString = $(xmlDoc).find("statusString").eq(0).text();
        var szSubStatusCode = $(xmlDoc).find("subStatusCode").eq(0).text();
        if ("" === szSubStatusCode) {
            if ("" === szSubStatusCode && "" === szStatusString) {
                if (xmlDoc) {
                    szTip += "(" + status + "," + xmlDoc + ")";
                } else {
                    szTip += "(" + status + ")";
                }
            } else {
                szTip += "(" + status + ", " + szStatusString + ")";
            }
        } else {
            szTip += "(" + status + ", " + szSubStatusCode + ")";
        }
    }
    szTip += "</div>";

    $("#opinfo").html(szTip + $("#opinfo").html());
}

// Display callback information
function showCBInfo(szInfo) {
    szInfo = "<div>" + dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss") + " " + szInfo + "</div>";
    $("#cbinfo").html(szInfo + $("#cbinfo").html());
}

// Format time
function dateFormat(oDate, fmt) {
    var o = {
        "M+": oDate.getMonth() + 1, //月份
        "d+": oDate.getDate(), //日
        "h+": oDate.getHours(), //小时
        "m+": oDate.getMinutes(), //分
        "s+": oDate.getSeconds(), //秒
        "q+": Math.floor((oDate.getMonth() + 3) / 3), //季度
        "S": oDate.getMilliseconds()//毫秒
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (oDate.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}


// Get window size
function getWindowSize() {
    var nWidth = $(this).width() + $(this).scrollLeft(),
        nHeight = $(this).height() + $(this).scrollTop();
    return { width: nWidth, height: nHeight };
}

// Open selection dialog (0: folder, 1: file)
function clickOpenFileDlg(id, iType) {
    WebVideoCtrl.I_OpenFileDlg(iType).then(function (szDirPath) {
        if (szDirPath != -1 && szDirPath != "" && szDirPath != null) {
            $("#" + id).val(szDirPath);
        }
    }, function () {
        showOPInfo("Failed to open file path");
    });
}

// Get local configuration
function clickGetLocalCfg() {
    WebVideoCtrl.I_GetLocalCfg().then((oLocalConfig) => {
        g_oLocalConfig = oLocalConfig;
        $("#netsPreach").val(oLocalConfig.buffNumberType);
        $("#wndSize").val(oLocalConfig.playWndType);
        $("#rulesInfo").val(oLocalConfig.ivsMode);
        $("#captureFileFormat").val(oLocalConfig.captureFileFormat);
        $("#packSize").val(oLocalConfig.packgeSize);
        $("#recordPath").val(oLocalConfig.recordPath);
        $("#downloadPath").val(oLocalConfig.downloadPath);
        $("#previewPicPath").val(oLocalConfig.capturePath);
        $("#playbackPicPath").val(oLocalConfig.playbackPicPath);
        $("#devicePicPath").val(oLocalConfig.deviceCapturePath);
        $("#playbackFilePath").val(oLocalConfig.playbackFilePath);
        $("#protocolType").val(oLocalConfig.protocolType);
        $("#ivsMode").val(oLocalConfig.ivsMode);
        $("#osdPosInfo").val(oLocalConfig.osdPosInfo);
        $("#secretKey").val("\x7F\x7F\x7F\x7F\x7F\x7F\x7F\x7F");
        showOPInfo("Local configuration retrieved successfully!");
    }, (oError) => {
        var szInfo = "Failed to retrieve local configuration!";
        showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
    });
}

// Set local configuration
async function clickSetLocalCfg() {
    g_oLocalConfig.buffNumberType = $("#netsPreach").val();
    g_oLocalConfig.playWndType = $("#wndSize").val();
    g_oLocalConfig.ivsMode = $("#rulesInfo").val();
    g_oLocalConfig.captureFileFormat = $("#captureFileFormat").val();
    g_oLocalConfig.packgeSize = $("#packSize").val();
    g_oLocalConfig.recordPath = $("#recordPath").val();
    g_oLocalConfig.downloadPath = $("#downloadPath").val();
    g_oLocalConfig.capturePath = $("#previewPicPath").val();
    g_oLocalConfig.playbackPicPath = $("#playbackPicPath").val();
    g_oLocalConfig.deviceCapturePath = $("#devicePicPath").val();
    g_oLocalConfig.playbackFilePath = $("#playbackFilePath").val();
    g_oLocalConfig.protocolType = $("#protocolType").val();
    g_oLocalConfig.ivsMode = $("#ivsMode").val();
    g_oLocalConfig.osdPosInfo = $("#osdPosInfo").val();
    if ("\x7F\x7F\x7F\x7F\x7F\x7F\x7F\x7F" !== $("#secretKey").val()) {
        g_oLocalConfig.secretKey = await WebVideoCtrl.I_GetEncryptString($("#secretKey").val());
    }
    WebVideoCtrl.I_SetLocalCfg(g_oLocalConfig).then(() => {
        showOPInfo("Local configuration set successfully!");
    }, (oError) => {
        var szInfo = "Failed to set local configuration!";
        showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
    });
}

// Window split number
function changeWndNum(iType) {
    if ("1*2" === iType || "2*1" === iType) {
        WebVideoCtrl.I_ArrangeWindow(iType).then(() => {
            showOPInfo("Window split successful!");
        }, (oError) => {
            var szInfo = "Window split failed!";
            showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
        });
    } else {
        iType = parseInt(iType, 10);
        WebVideoCtrl.I_ChangeWndNum(iType).then(() => {
            showOPInfo("Window split successful!");
        }, (oError) => {
            var szInfo = "Window split failed!";
            showOPInfo(szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Login
function clickLogin(szProtoType) {
    var szIP = $("#loginip").val(),
        szPort = $("#port").val(),
        szUsername = $("#username").val(),
        szPassword = $("#password").val();

    if ("" == szIP || "" == szPort) {
        return;
    }

    var szDeviceIdentify = szIP + "_" + szPort;

    WebVideoCtrl.I_Login(szIP, szProtoType, szPort, szUsername, szPassword, {
        timeout: 3000,
        success: function (xmlDoc) {
            showOPInfo(szDeviceIdentify + " login succeeded!");
            $("#ip").prepend("<option value='" + szDeviceIdentify + "'>" + szDeviceIdentify + "</option>");
            setTimeout(function () {
                $("#ip").val(szDeviceIdentify);
                setTimeout(function () {
                    getChannelInfo();
                }, 1000);
                getDevicePort();
            }, 10);
        },
        error: function (oError) {
            if (ERROR_CODE_LOGIN_REPEATLOGIN === status) {
                showOPInfo(szDeviceIdentify + " already logged in!");
            } else {
                if (oError.errorCode === 401) {
                    showOPInfo(szDeviceIdentify + " login failed, automatic authentication method switch!");
                } else {
                    showOPInfo(szDeviceIdentify + " login failed!", oError.errorCode, oError.errorMsg);
                }
            }
        }
    });
}

// Logout
function clickLogout() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_Logout(szDeviceIdentify).then(() => {
        $("#ip option:contains(" + szDeviceIdentify + ")").remove();
        showOPInfo(szDeviceIdentify + " logout succeeded!");
    }, () => {
        showOPInfo(szDeviceIdentify + " logout failed!");
    });
}

// Get device information
function clickGetDeviceInfo() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_GetDeviceInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var arrStr = [];
            arrStr.push("Device name: " + $(xmlDoc).find("deviceName").eq(0).text() + "\r\n");
            arrStr.push("Device ID: " + $(xmlDoc).find("deviceID").eq(0).text() + "\r\n");
            arrStr.push("Model: " + $(xmlDoc).find("model").eq(0).text() + "\r\n");
            arrStr.push("Serial number: " + $(xmlDoc).find("serialNumber").eq(0).text() + "\r\n");
            arrStr.push("MAC address: " + $(xmlDoc).find("macAddress").eq(0).text() + "\r\n");
            arrStr.push("Main control version: " + $(xmlDoc).find("firmwareVersion").eq(0).text() + " " + $(xmlDoc).find("firmwareReleasedDate").eq(0).text() + "\r\n");
            arrStr.push("Encoding version: " + $(xmlDoc).find("encoderVersion").eq(0).text() + " " + $(xmlDoc).find("encoderReleasedDate").eq(0).text() + "\r\n");

            showOPInfo(szDeviceIdentify + " Device information retrieval succeeded!");
            alert(arrStr.join(""));
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to retrieve device information!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Get channels
function getChannelInfo() {
    var szDeviceIdentify = $("#ip").val(),
        oSel = $("#channels").empty();

    if (null == szDeviceIdentify) {
        return;
    }

    // Analog channels
    WebVideoCtrl.I_GetAnalogChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("VideoInputChannel");

            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text();
                if ("" == name) {
                    name = "Camera " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                oSel.append("<option value='" + id + "' bZero='false'>" + name + "</option>");
            });
            showOPInfo(szDeviceIdentify + " Analog channels retrieval succeeded!");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to retrieve analog channels!", oError.errorCode, oError.errorMsg);
        }
    });

    // Digital channels
    WebVideoCtrl.I_GetDigitalChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("InputProxyChannelStatus");

            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text(),
                    online = $(this).find("online").eq(0).text();
                if ("false" == online) { // Filter disabled digital channels
                    return true;
                }
                if ("" == name) {
                    name = "IP Camera " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                oSel.append("<option value='" + id + "' bZero='false'>" + name + "</option>");
            });
            showOPInfo(szDeviceIdentify + " Digital channels retrieval succeeded!");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to retrieve digital channels!", oError.errorCode, oError.errorMsg);
        }
    });

    // Zero channels
    WebVideoCtrl.I_GetZeroChannelInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oChannels = $(xmlDoc).find("ZeroVideoChannel");

            $.each(oChannels, function (i) {
                var id = $(this).find("id").eq(0).text(),
                    name = $(this).find("name").eq(0).text();
                if ("" == name) {
                    name = "Zero Channel " + (i < 9 ? "0" + (i + 1) : (i + 1));
                }
                if ("true" == $(this).find("enabled").eq(0).text()) { // Filter disabled zero channels
                    oSel.append("<option value='" + id + "' bZero='true'>" + name + "</option>");
                }
            });
            showOPInfo(szDeviceIdentify + " Zero channels retrieval succeeded!");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to retrieve zero channels!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Get device port
function getDevicePort() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    var oPort = WebVideoCtrl.I_GetDevicePort(szDeviceIdentify).then((oPort) => {
        $("#deviceport").val(oPort.iDevicePort);
        $("#rtspport").val(oPort.iRtspPort);

        showOPInfo(szDeviceIdentify + " Port retrieval succeeded!");
    }, (oError) => {
        var szInfo = "Port retrieval failed!";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// Get digital channels
async function clickGetDigitalChannelInfo() {
    var szDeviceIdentify = $("#ip").val(),
        iAnalogChannelNum = 0;

    $("#digitalchannellist").empty();

    if (null == szDeviceIdentify) {
        return;
    }

    // Analog channels
    try {
        var oAnalogChannelInfo = await WebVideoCtrl.I_GetAnalogChannelInfo(szDeviceIdentify, {});
        iAnalogChannelNum = $(oAnalogChannelInfo).find("VideoInputChannel").length;
    } finally {
        // Digital channels
        WebVideoCtrl.I_GetDigitalChannelInfo(szDeviceIdentify, {
            success: function (xmlDoc) {
                var oChannels = $(xmlDoc).find("InputProxyChannelStatus");

                $.each(oChannels, function () {
                    var id = parseInt($(this).find("id").eq(0).text(), 10),
                        ipAddress = $(this).find("ipAddress").eq(0).text(),
                        srcInputPort = $(this).find("srcInputPort").eq(0).text(),
                        managePortNo = $(this).find("managePortNo").eq(0).text(),
                        online = $(this).find("online").eq(0).text(),
                        proxyProtocol = $(this).find("proxyProtocol").eq(0).text();

                    var objTr = $("#digitalchannellist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.innerHTML = (id - iAnalogChannelNum) < 10 ? "D0" + (id - iAnalogChannelNum) : "D" + (id - iAnalogChannelNum);
                    objTd = objTr.insertCell(1);
                    objTd.width = "25%";
                    objTd.innerHTML = ipAddress;
                    objTd = objTr.insertCell(2);
                    objTd.width = "15%";
                    objTd.innerHTML = srcInputPort;
                    objTd = objTr.insertCell(3);
                    objTd.width = "20%";
                    objTd.innerHTML = managePortNo;
                    objTd = objTr.insertCell(4);
                    objTd.width = "15%";
                    objTd.innerHTML = "true" == online ? "Online" : "Offline";
                    objTd = objTr.insertCell(5);
                    objTd.width = "25%";
                    objTd.innerHTML = proxyProtocol;
                });
                showOPInfo(szDeviceIdentify + " Digital channels retrieval succeeded!");
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " No digital channels found!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Start real-time playback
function clickStartRealPlay(iStreamType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iChannelID = parseInt($("#channels").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        szInfo = "";

    if ("undefined" === typeof iStreamType) {
        iStreamType = parseInt($("#streamtype").val(), 10);
    }

    if (null == szDeviceIdentify) {
        return;
    }

    var startRealPlay = function () {
        WebVideoCtrl.I_StartRealPlay(szDeviceIdentify, {
            iStreamType: iStreamType,
            iChannelID: iChannelID,
            bZeroChannel: bZeroChannel,
            iPort: iRtspPort,
            success: function () {
                console.log(1);
                szInfo = "Real-time playback started successfully!";
                showOPInfo(szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                console.log(2);
                showOPInfo(szDeviceIdentify + " Failed to start real-time playback!", oError.errorCode, oError.errorMsg);
            }
        });
    };

    if (oWndInfo != null) { // Already playing, stop first
        WebVideoCtrl.I_Stop({
            success: function () {
                startRealPlay();
            }
        });
    } else {
        startRealPlay();
    }
}

function destroyPlugin() {
    WebVideoCtrl.I_DestroyPlugin().then(() => {
        // Disable buttons
        document.querySelectorAll('input[type="button"]').forEach(button => {
            button.disabled = true;
        });
        document.querySelectorAll('a').forEach(link => {
            link.removeAttribute('onclick'); // Remove inline event handlers
            link.removeAttribute('href');
            link.setAttribute('aria-disabled', 'true'); // Accessibility technology can recognize
            link.style.cursor = 'default'; // Remove hand cursor
            // Create a new node without events to replace the old one
            const newLink = link.cloneNode(false);
            newLink.textContent = link.textContent;
            link.parentNode.replaceChild(newLink, link);
        });
        // Cannot preview after destruction
        showOPInfo('Destruction successful!');
    }).catch(() => {
        showOPInfo('Destruction failed!');
    });
}

function showPlugin() {
    WebVideoCtrl.I_ShowPlugin().then(() => {
        showOPInfo('Display successful!');
    }).catch(() => {
        showOPInfo('Display failed!');
    });
}

function hidPlugin() {
    WebVideoCtrl.I_HidPlugin().then(() => {
        showOPInfo('Hide successful!');
    }).catch(() => {
        showOPInfo('Hide failed!');
    });
}

function setTextOverlay() {
    var szDeviceIdentify = $("#ip").val();
    var szInfo = "";
    var that = this;
    var iChannelID = parseInt($("#channels").val(), 10);
    var szUrl = "ISAPI/System/Video/inputs/channels/" + iChannelID + "/overlays";
    WebVideoCtrl.I_GetTextOverlay(szUrl, szDeviceIdentify, {
        success: function (data) {
            $(data).find("TextOverlay").eq(0).find("displayText").eq(0).text("I tet");
            $(data).find("TextOverlay").eq(0).find("positionX").eq(0).text("20");
            $(data).find("TextOverlay").eq(0).find("positionY").eq(0).text("30");
            var xmldoc = toXMLStr(data);
            var newOptions = {
                type: "PUT",
                data: xmldoc,
                success: function () {
                    szInfo = "OSD text overlay drawn successfully";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function (oError) {
                    showOPInfo(szDeviceIdentify + " Failed to set OSD text overlay!", oError.errorCode, oError.errorMsg);
                }
            };

            WebVideoCtrl.I_SendHTTPRequest(szDeviceIdentify, szUrl, newOptions);
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to set OSD text overlay!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Stop all video playback
function stopAllPlay() {
    WebVideoCtrl.I_StopAllPlay().then(() => {
        showOPInfo('Stopped all video playback successfully!');
    }).catch(() => {
        showOPInfo('Failed!');
    });
}

// Stop real-time playback
function clickStopRealPlay() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                szInfo = "Stopped real-time playback successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " Failed to stop real-time playback!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Enable sound
function clickOpenSound() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_OpenSound().then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " Sound opened successfully!");
        }, (oError) => {
            var szInfo = "Failed to open sound!";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Disable sound
function clickCloseSound() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_CloseSound().then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " Sound closed successfully!");
        }, (oError) => {
            var szInfo = "Failed to close sound!";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Set volume
function clickSetVolume() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iVolume = parseInt($("#volume").val(), 10),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_SetVolume(iVolume).then(() => {
            showOPInfo(oWndInfo.szDeviceIdentify + " Volume set successfully");
        }, (oError) => {
            var szInfo = "Failed to set volume!";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Capture image
async function clickCapturePic(szType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        var oLocalConfig = await WebVideoCtrl.I_GetLocalCfg();
        var szCaptureFileFormat = "0";
        if (oLocalConfig) {
            szCaptureFileFormat = oLocalConfig.captureFileFormat;
        }

        var szChannelID = $("#channels").val();
        var szPicName = oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();
        // If it's a playback capture, add the prefix "playback_"
        if ("playback" === szType) {
            szPicName = "playback_" + oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();
        }

        szPicName += ("0" === szCaptureFileFormat) ? ".jpg" : ".bmp";
        WebVideoCtrl.I_CapturePic(szPicName, {}).then(function () {
            szInfo = "Image captured successfully!";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        }, function (oError) {
            szInfo = "Failed to capture image!";
            showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Capture image data
function clickCapturePicData() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_CapturePicData().then(function (data) {
            console.log(data);
            szInfo = "Image uploaded successfully!";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        }, function () {
            szInfo = "Failed to capture image!";
            showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
        });
    }
}

// Start recording
var g_szRecordType = "";
function clickStartRecord(szType) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    g_szRecordType = szType;

    if (oWndInfo != null) {
        var szChannelID = $("#channels").val(),
            szFileName = oWndInfo.szDeviceIdentify + "_" + szChannelID + "_" + new Date().getTime();

        WebVideoCtrl.I_StartRecord(szFileName, {
            success: function () {
                if ('realplay' === szType) {
                    szInfo = "Recording started successfully!";
                } else if ('playback' === szType) {
                    szInfo = "Clipping started successfully!";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                if ('realplay' === szType) {
                    szInfo = "Failed to start recording!";
                } else if ('playback' === szType) {
                    szInfo = "Failed to start clipping!";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Stop recording
function clickStopRecord(szType, iWndIndex) {
    if ("undefined" === typeof iWndIndex) {
        iWndIndex = g_iWndIndex;
    }
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_StopRecord({
            success: function () {
                if ('realplay' === szType) {
                    szInfo = "Recording stopped successfully!";
                } else if ('playback' === szType) {
                    szInfo = "Clipping stopped successfully!";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                if ('realplay' === szType) {
                    szInfo = "Failed to stop recording!";
                } else if ('playback' === szType) {
                    szInfo = "Failed to stop clipping!";
                }
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Get audio channels
function clickGetAudioInfo() {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_GetAudioInfo(szDeviceIdentify, {
        success: function (xmlDoc) {
            var oAudioChannels = $(xmlDoc).find("TwoWayAudioChannel"),
                oSel = $("#audiochannels").empty();
            $.each(oAudioChannels, function () {
                var id = $(this).find("id").eq(0).text();

                oSel.append("<option value='" + id + "'>" + id + "</option>");
            });
            showOPInfo(szDeviceIdentify + " Audio channels retrieval succeeded!");
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Failed to retrieve audio channels!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Start voice talk
function clickStartVoiceTalk() {
    var szDeviceIdentify = $("#ip").val(),
        iAudioChannel = parseInt($("#audiochannels").val(), 10),
        szInfo = "";

    if (null == szDeviceIdentify) {
        return;
    }

    if (isNaN(iAudioChannel)) {
        alert("Please select an audio channel!");
        return;
    }

    WebVideoCtrl.I_StartVoiceTalk(szDeviceIdentify, iAudioChannel).then(() => {
        szInfo = "Voice talk started successfully!";
        showOPInfo(szDeviceIdentify + " " + szInfo);
    }, (oError) => {
        var szInfo = "Failed to start voice talk!";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// Stop voice talk
function clickStopVoiceTalk() {
    var szDeviceIdentify = $("#ip").val();
    WebVideoCtrl.I_StopVoiceTalk().then(() => {
        szInfo = "Voice talk stopped successfully!";
        showOPInfo(szDeviceIdentify + " " + szInfo);
    }, (oError) => {
        var szInfo = "Failed to stop voice talk!";
        showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
    });
}

// Enable electronic zoom
function clickEnableEZoom() {
    var szDeviceIdentify = $("#ip").val();
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_EnableEZoom().then(() => {
            szInfo = "Electronic zoom enabled successfully!";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "Failed to enable electronic zoom!";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Disable electronic zoom
function clickDisableEZoom() {
    var szDeviceIdentify = $("#ip").val();
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_DisableEZoom().then(() => {
            szInfo = "Electronic zoom disabled successfully!";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "Failed to disable electronic zoom!";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Enable 3D zoom
function clickEnable3DZoom() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";
    var szDeviceIdentify = $("#ip").val();

    if (oWndInfo != null) {
        WebVideoCtrl.I_Enable3DZoom().then(() => {
            szInfo = "3D zoom enabled successfully!";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "Failed to enable 3D zoom!";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Disable 3D zoom
function clickDisable3DZoom() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";
    var szDeviceIdentify = $("#ip").val();

    if (oWndInfo != null) {
        WebVideoCtrl.I_Disable3DZoom().then(() => {
            szInfo = "3D zoom disabled successfully!";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "Failed to disable 3D zoom!";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    }
}

// Full screen
function clickFullScreen() {
    WebVideoCtrl.I_FullScreen(true).then(() => {
        showOPInfo("Full screen successful");
    }, (oError) => {
        showOPInfo("Full screen failed!", oError.errorCode, oError.errorMsg);
    });
}

// PTZ control (9 for auto, 1,2,3,4,5,6,7,8 for direction PTZ)
var g_bPTZAuto = false;
function mouseDownPTZControl(iPTZIndex) {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iPTZSpeed = $("#ptzspeed").val();

    if (bZeroChannel) { // Zero channel does not support PTZ
        return;
    }

    if (oWndInfo != null) {
        if (9 == iPTZIndex && g_bPTZAuto) {
            iPTZSpeed = 0; // Auto mode sets speed to 0 to stop
        } else {
            g_bPTZAuto = false; // Clicking other directions stops auto mode
        }

        WebVideoCtrl.I_PTZControl(iPTZIndex, false, {
            iPTZSpeed: iPTZSpeed,
            success: function (xmlDoc) {
                if (9 == iPTZIndex && g_bPTZAuto) {
                    showOPInfo(oWndInfo.szDeviceIdentify + " PTZ stopped successfully!");
                } else {
                    showOPInfo(oWndInfo.szDeviceIdentify + " PTZ started successfully!");
                }
                if (9 == iPTZIndex) {
                    g_bPTZAuto = !g_bPTZAuto;
                }
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Failed to start PTZ!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Direction PTZ stop
function mouseUpPTZControl() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(1, true, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " PTZ stopped successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Failed to stop PTZ!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Set preset point
function clickSetPreset() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iPresetID = parseInt($("#preset").val(), 10);

    if (oWndInfo != null) {
        WebVideoCtrl.I_SetPreset(iPresetID, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Preset point set successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Failed to set preset point!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Go to preset point
function clickGoPreset() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        iPresetID = parseInt($("#preset").val(), 10);

    if (oWndInfo != null) {
        WebVideoCtrl.I_GoPreset(iPresetID, {
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Preset point reached successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Failed to reach preset point!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Search recordings
var g_iSearchTimes = 0;
function clickRecordSearch(iType) {
    var szDeviceIdentify = $("#ip").val(),
        iChannelID = parseInt($("#channels").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val();

    if (!szStartTime || !szEndTime) {
        alert("Start or end time cannot be empty!");
        return;
    }

    if (Date.parse(szEndTime.replace(/-/g, "/")) - Date.parse(szStartTime.replace(/-/g, "/")) < 0) {
        alert("Start time is greater than end time");
        return;
    }

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) { // Zero channel does not support recording search
        return;
    }

    if (0 == iType) { // First search
        $("#searchlist").empty();
        g_iSearchTimes = 0;
    }

    // If it's a front-end device, convert search time to UTC time
    WebVideoCtrl.I_RecordSearch(szDeviceIdentify, iChannelID, szStartTime, szEndTime, {
        iStreamType: iStreamType,
        iSearchPos: g_iSearchTimes,
        success: function (xmlDoc) {
            if ("MORE" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                for (var i = 0, nLen = $(xmlDoc).find("searchMatchItem").length; i < nLen; i++) {
                    var szPlaybackURI = $(xmlDoc).find("playbackURI").eq(i).text();
                    if (szPlaybackURI.indexOf("name=") < 0) {
                        break;
                    }
                    var szStartTime = $(xmlDoc).find("startTime").eq(i).text();
                    var szEndTime = $(xmlDoc).find("endTime").eq(i).text();
                    var szFileName = szPlaybackURI.substring(szPlaybackURI.indexOf("name=") + 5, szPlaybackURI.indexOf("&size="));

                    var objTr = $("#searchlist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.id = "downloadTd" + i;
                    objTd.innerHTML = g_iSearchTimes + 1;
                    objTd = objTr.insertCell(1);
                    objTd.width = "30%";
                    objTd.innerHTML = szFileName;
                    objTd = objTr.insertCell(2);
                    objTd.width = "30%";
                    objTd.innerHTML = (szStartTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(3);
                    objTd.width = "30%";
                    objTd.innerHTML = (szEndTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(4);
                    objTd.width = "10%";

                    const link = document.createElement('a');
                    link.href = 'javascript:;';
                    link.textContent = 'Download';

                    // Store data directly in element attributes
                    link.dataset.index = g_iSearchTimes;
                    link.dataset.fileName = szFileName;
                    link.dataset.playbackUri = szPlaybackURI;

                    // Event listener instead of onclick
                    link.addEventListener('click', () => {
                        clickStartDownloadRecord(link.dataset.index, link.dataset.fileName, link.dataset.playbackUri);
                    });

                    objTd.appendChild(link);

                    $("#downloadTd" + g_iSearchTimes).data("fileName", szFileName);
                    $("#downloadTd" + g_iSearchTimes).data("playbackURI", szPlaybackURI);
                    ++g_iSearchTimes;
                }

                clickRecordSearch(1); // Continue searching
            } else if ("OK" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                var iLength = $(xmlDoc).find("searchMatchItem").length;
                for (var i = 0; i < iLength; i++) {
                    var szPlaybackURI = $(xmlDoc).find("playbackURI").eq(i).text();
                    if (szPlaybackURI.indexOf("name=") < 0) {
                        break;
                    }
                    var szStartTime = $(xmlDoc).find("startTime").eq(i).text();
                    var szEndTime = $(xmlDoc).find("endTime").eq(i).text();
                    var szFileName = szPlaybackURI.substring(szPlaybackURI.indexOf("name=") + 5, szPlaybackURI.indexOf("&size="));

                    var objTr = $("#searchlist").get(0).insertRow(-1);
                    var objTd = objTr.insertCell(0);
                    objTd.id = "downloadTd" + i;
                    objTd.innerHTML = g_iSearchTimes + 1;
                    objTd = objTr.insertCell(1);
                    objTd.width = "30%";
                    objTd.innerHTML = szFileName;
                    objTd = objTr.insertCell(2);
                    objTd.width = "30%";
                    objTd.innerHTML = (szStartTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(3);
                    objTd.width = "30%";
                    objTd.innerHTML = (szEndTime.replace("T", " ")).replace("Z", "");
                    objTd = objTr.insertCell(4);
                    objTd.width = "10%";

                    const link = document.createElement('a');
                    link.href = 'javascript:;';
                    link.textContent = 'Download';

                    // Store data directly in element attributes
                    link.dataset.index = g_iSearchTimes;
                    link.dataset.fileName = szFileName;
                    link.dataset.playbackUri = szPlaybackURI;

                    // Event listener instead of onclick
                    link.addEventListener('click', () => {
                        clickStartDownloadRecord(link.dataset.index, link.dataset.fileName, link.dataset.playbackUri);
                    });

                    objTd.appendChild(link);

                    $("#downloadTd" + g_iSearchTimes).data("fileName", szFileName);
                    $("#downloadTd" + g_iSearchTimes).data("playbackURI", szPlaybackURI);
                    ++g_iSearchTimes;
                }
                showOPInfo(szDeviceIdentify + " Recording search successful!");
            } else if ("NO MATCHES" === $(xmlDoc).find("responseStatusStrg").eq(0).text()) {
                setTimeout(function () {
                    g_iSearchTimes = 0;
                    showOPInfo(szDeviceIdentify + " No recordings found!");
                }, 50);
            }
        },
        error: function (oError) {
            g_iSearchTimes = 0;
            showOPInfo(szDeviceIdentify + " Recording search failed!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Start playback
function clickStartPlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iChannelID = parseInt($("#channels").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val(),
        szInfo = "",
        bChecked = $("#transstream").prop("checked"),
        iRet = -1;

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) { // Zero channel does not support playback
        return;
    }

    if (!szStartTime || !szEndTime) {
        alert("Start or end time cannot be empty!");
        return;
    }

    if (Date.parse(szEndTime.replace(/-/g, "/")) - Date.parse(szStartTime.replace(/-/g, "/")) < 0) {
        alert("Start time is greater than end time");
        return;
    }

    var startPlayback = function () {
        if (bChecked) { // Enable transcoding playback
            var oTransCodeParam = {
                TransFrameRate: "14", // 0: Full frame rate, 5: 1, 6: 2, 7: 4, 8: 6, 9: 8, 10: 10, 11: 12, 12: 16, 14: 15, 15: 18, 13: 20, 16: 22
                TransResolution: "1", // 255: Auto, 3: 4CIF, 2: QCIF, 1: CIF
                TransBitrate: "19" // 2: 32K, 3: 48K, 4: 64K, 5: 80K, 6: 96K, 7: 128K, 8: 160K, 9: 192K, 10: 224K, 11: 256K, 12: 320K, 13: 384K, 14: 448K, 15: 512K, 16: 640K, 17: 768K, 18: 896K, 19: 1024K, 20: 1280K, 21: 1536K, 22: 1792K, 23: 2048K, 24: 3072K, 25: 4096K, 26: 8192K
            };
            WebVideoCtrl.I_StartPlayback(szDeviceIdentify, {
                iRtspPort: iRtspPort,
                iStreamType: iStreamType,
                iChannelID: iChannelID,
                szStartTime: szStartTime,
                szEndTime: szEndTime,
                oTransCodeParam: oTransCodeParam,
                success: function () {
                    szInfo = "Playback started successfully!";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function (oError) {
                    szInfo = "Failed to start playback!";
                    showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
                }
            });
        } else {
            WebVideoCtrl.I_StartPlayback(szDeviceIdentify, {
                iRtspPort: iRtspPort,
                iStreamType: iStreamType,
                iChannelID: iChannelID,
                szStartTime: szStartTime,
                szEndTime: szEndTime,
                success: function () {
                    szInfo = "Playback started successfully!";
                    showOPInfo(szDeviceIdentify + " " + szInfo);
                },
                error: function (oError) {
                    szInfo = "Failed to start playback!";
                    showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
                }
            });
        }
    };

    if (oWndInfo != null) { // Already playing, stop first
        WebVideoCtrl.I_Stop({
            success: function () {
                startPlayback();
            }
        });
    } else {
        startPlayback();
    }
}

// Stop playback
function clickStopPlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Stop({
            success: function () {
                szInfo = "Playback stopped successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to stop playback!";
                showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Start reverse playback
function clickReversePlayback() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szDeviceIdentify = $("#ip").val(),
        iRtspPort = parseInt($("#rtspport").val(), 10),
        iStreamType = parseInt($("#record_streamtype").val(), 10),
        bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false,
        iChannelID = parseInt($("#channels").val(), 10),
        szStartTime = $("#starttime").val(),
        szEndTime = $("#endtime").val(),
        szInfo = "";

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) { // Zero channel does not support reverse playback
        return;
    }

    var reversePlayback = function () {
        WebVideoCtrl.I_ReversePlayback(szDeviceIdentify, {
            iRtspPort: iRtspPort,
            iStreamType: iStreamType,
            iChannelID: iChannelID,
            szStartTime: szStartTime,
            szEndTime: szEndTime
        }).then(() => {
            szInfo = "Reverse playback started successfully!";
            showOPInfo(szDeviceIdentify + " " + szInfo);
        }, (oError) => {
            szInfo = "Failed to start reverse playback!";
            showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
        });
    };

    if (oWndInfo != null) { // Already playing, stop first
        WebVideoCtrl.I_Stop({
            success: function () {
                reversePlayback();
            }
        });
    } else {
        reversePlayback();
    }
}

// Single frame
function clickFrame() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Frame({
            success: function () {
                szInfo = "Single frame played successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to play single frame!";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Pause
function clickPause() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Pause({
            success: function () {
                szInfo = "Paused successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to pause!";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Resume
function clickResume() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_Resume({
            success: function () {
                szInfo = "Resumed successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to resume!";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Slow motion
function clickPlaySlow() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_PlaySlow({
            success: function () {
                szInfo = "Slow motion started successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to start slow motion!";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Fast forward
function clickPlayFast() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex),
        szInfo = "";

    if (oWndInfo != null) {
        WebVideoCtrl.I_PlayFast({
            success: function () {
                szInfo = "Fast forward started successfully!";
                showOPInfo(oWndInfo.szDeviceIdentify + " " + szInfo);
            },
            error: function (oError) {
                szInfo = "Failed to start fast forward!";
                showOPInfo(oWndInfo.szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// OSD time
function clickGetOSDTime() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_GetOSDTime({
            success: function (szOSDTime) {
                $("#osdtime").val(szOSDTime);
                showOPInfo(oWndInfo.szDeviceIdentify + " OSD time retrieval successful!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Failed to retrieve OSD time!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Download recording
var g_iDownloadID = -1;
var g_tDownloadProcess = 0;
function clickStartDownloadRecord(i, szFileName, szPlaybackURI) {
    var szDeviceIdentify = $("#ip").val();

    if (null == szDeviceIdentify) {
        return;
    }

    WebVideoCtrl.I_StartDownloadRecord(szDeviceIdentify, szPlaybackURI, szFileName, {}).then((iDownloadID) => {
        g_iDownloadID = iDownloadID;
        $("<div id='downProcess' class='freeze'></div>").appendTo("body");
        g_tDownloadProcess = setInterval("downProcess(" + i + ")", 1000);
    }, (oError) => {
        WebVideoCtrl.I_GetLastError().then((iErrorValue) => {
            if (34 == iErrorValue) {
                showOPInfo(szDeviceIdentify + " Already downloaded!");
            } else if (33 == iErrorValue) {
                showOPInfo(szDeviceIdentify + " Insufficient space!");
            } else {
                showOPInfo(szDeviceIdentify + " Download failed!");
            }
        });
    });
}

function clickStartDownloadRecordByTime() {
    var szDeviceIdentify = $("#ip").val(),
        szChannelID = $("#channels").val(),
        szFileName = $("#downloadTd0").data("fileName"),
        szPlaybackURI = $("#downloadTd0").data("playbackURI"),
        szStartTime = $("#downloadstarttime").val(),
        szEndTime = $("#downloadendtime").val();

    if (null == szDeviceIdentify) {
        return;
    }

    if (Date.parse(szEndTime.replace(/-/g, "/")) - Date.parse(szStartTime.replace(/-/g, "/")) < 0) {
        alert("Start time is greater than end time");
        return;
    }

    WebVideoCtrl.I_StartDownloadRecordByTime(szDeviceIdentify, szPlaybackURI, szFileName, szStartTime, szEndTime, {}).then((iDownloadID) => {
        g_iDownloadID = iDownloadID;
        $("<div id='downProcess' class='freeze'></div>").appendTo("body");
        g_tDownloadProcess = setInterval("downProcess(" + 0 + ")", 1000);
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " Download failed!");
    });
}

function clickStopDownload() {
    WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID).then(() => {
        showOPInfo("Download stopped successfully!");
        clearInterval(g_tDownloadProcess);
        g_tDownloadProcess = 0;
        g_iDownloadID = -1;
        $("#downProcess").remove();
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " Failed to stop download!", oError.errorCode, oError.errorMsg);
    });
}

// Download Progress
async function downProcess() {
    var iStatus = await WebVideoCtrl.I_GetDownloadStatus(g_iDownloadID);
    if (0 == iStatus) {
        $("#downProcess").css({
            width: $("#searchlist").width() + "px",
            height: "100px",
            lineHeight: "100px",
            left: $("#searchdiv").offset().left + "px",
            top: $("#searchdiv").offset().top + "px"
        });
        var iProcess = await WebVideoCtrl.I_GetDownloadProgress(g_iDownloadID);
        if (iProcess < 0) {
            clearInterval(g_tDownloadProcess);
            g_tDownloadProcess = 0;
            g_iDownloadID = -1;
        } else if (iProcess < 100) {
            $("#downProcess").text(iProcess + "%");
        } else {
            $("#downProcess").text("100%");
            setTimeout(function () {
                $("#downProcess").remove();
            }, 1000);
            await WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID);
            showOPInfo("Recording download completed! Please check the saved path in the plugin.");
            clearInterval(g_tDownloadProcess);
            g_tDownloadProcess = 0;
            g_iDownloadID = -1;
        }
    } else {
        await WebVideoCtrl.I_StopDownloadRecord(g_iDownloadID);
        clearInterval(g_tDownloadProcess);
        g_tDownloadProcess = 0;
        g_iDownloadID = -1;
    }
}

// Export Configuration File
// function clickExportDeviceConfig() {
//     var szDeviceIdentify = $("#ip").val(),
//         szInfo = "";

//     if (null == szDeviceIdentify) {
//         return;
//     }
//     var szDevicePassWord = $("#edfpassword").val();

//     WebVideoCtrl.I_ExportDeviceConfig(szDeviceIdentify, szDevicePassWord).then(() => {
//         szInfo = "Configuration file exported successfully!";
//         showOPInfo(szDeviceIdentify + " " + szInfo);
//     }, (oError) => {
//         szInfo = "Failed to export configuration file!";
//         showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
//     });
// }

// Import Configuration File
// function clickImportDeviceConfig() {
//     var szDeviceIdentify = $("#ip").val(),
//         szFileName = $("#configFile").val(),
//         szDevicePassWord = $("#edfpassword").val(),
//         szInfo = "";

//     if (null == szDeviceIdentify) {
//         return;
//     }

//     if ("" == szFileName) {
//         alert("Please select a configuration file!");
//         return;
//     }

//     WebVideoCtrl.I_ImportDeviceConfig(szDeviceIdentify, szFileName, szDevicePassWord).then(() => {
//         szInfo = "Import successful!";
//         showOPInfo(szDeviceIdentify + " " + szInfo);
//         WebVideoCtrl.I_Restart(szDeviceIdentify, {
//             success: function (xmlDoc) {
//                 $("<div id='restartDiv' class='freeze'>Restarting...</div>").appendTo("body");
//                 var oSize = getWindowSize();
//                 $("#restartDiv").css({
//                     width: oSize.width + "px",
//                     height: oSize.height + "px",
//                     lineHeight: oSize.height + "px",
//                     left: 0,
//                     top: 0
//                 });
//                 setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
//             },
//             error: function (oError) {
//                 showOPInfo(szDeviceIdentify + " Restart failed!", oError.errorCode, oError.errorMsg);
//             }
//         });
//     }, (oError) => {
//         szInfo = "Import failed!";
//         showOPInfo(szDeviceIdentify + szInfo, oError.errorCode, oError.errorMsg);
//     });
// }

// Reconnect
function reconnect(szDeviceIdentify) {
    WebVideoCtrl.I_Reconnect(szDeviceIdentify, {
        timeout: 3000,
        success: function (xmlDoc) {
            $("#restartDiv").remove();
            window.location.reload();
        },
        error: function () {
            setTimeout(function () { reconnect(szDeviceIdentify); }, 5000);
        }
    });
}

// Start Upgrade
var g_tUpgrade = 0;
function clickStartUpgrade(szDeviceIdentify) {
    var szDeviceIdentify = $("#ip").val(),
        szFileName = $("#upgradeFile").val();

    if (null == szDeviceIdentify) {
        return;
    }

    if ("" == szFileName) {
        alert("Please select an upgrade file!");
        return;
    }

    WebVideoCtrl.I_StartUpgrade(szDeviceIdentify, szFileName).then(function () {
        g_tUpgrade = setInterval("getUpgradeStatus('" + szDeviceIdentify + "')", 1000);
    }, function () {
        clearInterval(g_tUpgrade);
        showOPInfo(szDeviceIdentify + " Upgrade failed!");
    });
}

// Get Upgrade Status
async function getUpgradeStatus(szDeviceIdentify) {
    var bUpdating = await WebVideoCtrl.I_UpgradeStatus(szDeviceIdentify);
    if (bUpdating) {
        var iProcess = await WebVideoCtrl.I_UpgradeProgress(szDeviceIdentify);
        if (iProcess < 0) {
            clearInterval(g_tUpgrade);
            g_tUpgrade = 0;
            showOPInfo(szDeviceIdentify + " Failed to get upgrade progress!");
            return;
        } else if (iProcess < 100) {
            if (0 == $("#restartDiv").length) {
                $("<div id='restartDiv' class='freeze'></div>").appendTo("body");
                var oSize = getWindowSize();
                $("#restartDiv").css({
                    width: oSize.width + "px",
                    height: oSize.height + "px",
                    lineHeight: oSize.height + "px",
                    left: 0,
                    top: 0
                });
            }
            $("#restartDiv").text(iProcess + "%");
        } else {
            await WebVideoCtrl.I_StopUpgrade();
            clearInterval(g_tUpgrade);
            g_tUpgrade = 0;
            $("#restartDiv").remove();
            WebVideoCtrl.I_Restart(szDeviceIdentify, {
                success: function (xmlDoc) {
                    $("<div id='restartDiv' class='freeze'>Restarting...</div>").appendTo("body");
                    var oSize = getWindowSize();
                    $("#restartDiv").css({
                        width: oSize.width + "px",
                        height: oSize.height + "px",
                        lineHeight: oSize.height + "px",
                        left: 0,
                        top: 0
                    });
                    setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
                },
                error: function (oError) {
                    showOPInfo(szDeviceIdentify + " Restart failed!", oError.errorCode, oError.errorMsg);
                }
            });
        }
    } else {
        await WebVideoCtrl.I_StopUpgrade();
        clearInterval(g_tUpgrade);
        g_tUpgrade = 0;
        $("#restartDiv").remove();
        WebVideoCtrl.I_Restart(szDeviceIdentify, {
            success: function () {
                $("<div id='restartDiv' class='freeze'>Restarting...</div>").appendTo("body");
                var oSize = getWindowSize();
                $("#restartDiv").css({
                    width: oSize.width + "px",
                    height: oSize.height + "px",
                    lineHeight: oSize.height + "px",
                    left: 0,
                    top: 0
                });
                setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
            },
            error: function (oError) {
                showOPInfo(szDeviceIdentify + " Restart failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Restart Device
function restart() {
    var szDeviceIdentify = $("#ip").val();
    WebVideoCtrl.I_Restart(szDeviceIdentify, {
        success: function () {
            showOPInfo(szDeviceIdentify + " Restart succeeded!");
            $("<div id='restartDiv' class='freeze'>Restarting...</div>").appendTo("body");
            var oSize = getWindowSize();
            $("#restartDiv").css({
                width: oSize.width + "px",
                height: oSize.height + "px",
                lineHeight: oSize.height + "px",
                left: 0,
                top: 0
            });
            setTimeout("reconnect('" + szDeviceIdentify + "')", 20000);
        },
        error: function (oError) {
            showOPInfo(szDeviceIdentify + " Restart failed!", oError.errorCode, oError.errorMsg);
        }
    });
}

// Check Plugin Version
function clickCheckPluginVersion() {
    var szDeviceIdentify = $("#ip").val();
    WebVideoCtrl.I_CheckPluginVersion().then((bNeedUpdate) => {
        if (bNeedUpdate) {
            alert("A new plugin version is available!");
        } else {
            alert("Your plugin version is already the latest!");
        }
    }, () => {
        showOPInfo(szDeviceIdentify + " Failed to check for new plugin versions");
    });
}

function clickRestoreDefault() {
    var szDeviceIdentify = $("#ip").val(),
        szMode = "basic";
    WebVideoCtrl.I_RestoreDefault(szDeviceIdentify, szMode).then(() => {
        $("#restartDiv").remove();
        showOPInfo(szDeviceIdentify + " Successfully restored default settings (basic mode)!");
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " Failed to restore default settings (basic mode)!", oError.errorCode, oError.errorMsg);
    });
}

function clickRestoreFullDefault() {
    var szDeviceIdentify = $("#ip").val(),
        szMode = "full";
    WebVideoCtrl.I_RestoreDefault(szDeviceIdentify, szMode).then(() => {
        $("#restartDiv").remove();
        showOPInfo(szDeviceIdentify + " Successfully restored full default settings!");
    }, (oError) => {
        showOPInfo(szDeviceIdentify + " Failed to restore full default settings!", oError.errorCode, oError.errorMsg);
    });
}

function PTZZoomIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(10, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom in successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom in failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZZoomout() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(11, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom out successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom out failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZZoomStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(11, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom stopped successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Zoom stop failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFocusIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(12, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus in successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus in failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFoucusOut() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(13, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus out successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus out failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZFoucusStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(12, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus stop successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Focus stop failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisIn() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(14, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris in successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris in failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisOut() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(15, false, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris out successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris out failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

function PTZIrisStop() {
    var oWndInfo = WebVideoCtrl.I_GetWindowStatus(g_iWndIndex);

    if (oWndInfo != null) {
        WebVideoCtrl.I_PTZControl(14, true, {
            iWndIndex: g_iWndIndex,
            success: function (xmlDoc) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris stop successfully!");
            },
            error: function (oError) {
                showOPInfo(oWndInfo.szDeviceIdentify + " Iris stop failed!", oError.errorCode, oError.errorMsg);
            }
        });
    }
}

// Switch Mode
function changeIPMode(iType) {
    var arrPort = [0, 7071, 80];
    $("#serverport").val(arrPort[iType]);
}

// Get Device IP, B1 is not supported
// function clickGetDeviceIP() {
//     var iDeviceMode = parseInt($("#devicemode").val(), 10),
//         szAddress = $("#serveraddress").val(),
//         iPort = parseInt($("#serverport").val(), 10) || 0,
//         szDeviceID = $("#deviceid").val(),
//         szDeviceInfo = "";

//     szDeviceInfo = WebVideoCtrl.I_GetIPInfoByMode(iDeviceMode, szAddress, iPort, szDeviceID);

//     if ("" == szDeviceInfo) {
//         showOPInfo("Failed to parse device IP and port!");
//     } else {
//         showOPInfo("Successfully parsed device IP and port!");

//         var arrTemp = szDeviceInfo.split("-");
//         $("#loginip").val(arrTemp[0]);
//         $("#deviceport").val(arrTemp[1]);
//     }
// }

// Enable Polygon Drawing
var g_bEnableDraw = false;
function clickEnableDraw() {
    WebVideoCtrl.I_SetDrawStatus(true).then(() => {
        g_bEnableDraw = true;
        showOPInfo("Drawing enabled successfully!");
    }, (oError) => {
        showOPInfo("Failed to enable drawing!", oError.errorCode, oError.errorMsg);
    });
}

// Disable Polygon Drawing
function clickDisableDraw() {
    WebVideoCtrl.I_SetDrawStatus(false).then(() => {
        g_bEnableDraw = false;
        showOPInfo("Drawing disabled successfully!");
    }, (oError) => {
        showOPInfo("Failed to disable drawing!", oError.errorCode, oError.errorMsg);
    });
}

// Add Shapes, up to 16 shapes allowed
function clickAddSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    var szId = $("#snapId").val();
    if (!/^[1-9]\d*$/.test(szId)) {
        alert("Shape ID must be a positive integer!");
        return;
    }
    if (Number(szId) > 32) {
        alert("Shape ID range is 1-32!");
        return;
    }

    var szName = encodeString($("#snapName").val());

    var szInfo = "<?xml version='1.0' encoding='utf-8'?>";
    szInfo += "<SnapPolygonList>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>" + szId + "</id>";          // [1, 32]
    szInfo += "<polygonType>0</polygonType>"; // To draw a polygon, change polygonType to 1
    szInfo += "<PointNumMax>17</PointNumMax>";  // [MinClosed, 17]
    szInfo += "<MinClosed>4</MinClosed>";       // [4, 17]
    szInfo += "<tips>#" + szId + "#" + szName + "</tips>";
    szInfo += "<isClosed>false</isClosed>";
    szInfo += "<color><r>0</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList/>";
    szInfo += "</SnapPolygon>";
    szInfo += "</SnapPolygonList>";

    WebVideoCtrl.I_SetSnapPolygonInfo(g_iWndIndex, szInfo).then(() => {
        showOPInfo("Shape added successfully!");
    });
    WebVideoCtrl.I_SetSnapDrawMode(g_iWndIndex, 2);
}

// Delete Shape
function clickDelSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    var szId = $("#snapId").val();
    var aShapes = [];
    aShapes.push({
        polygonType: 0,
        id: szId
    });

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex, aShapes);
}

// Get Shapes, save to own database
function clickGetSnapPolygon() {
    WebVideoCtrl.I_GetSnapPolygonInfo(g_iWndIndex).then((szXml) => {
        alert(szXml);
        console.log('Got shapes:', szXml);
    });
}

// Set Shapes, set previously set shapes when page opens
function clickSetSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex);

    var szInfo = "<?xml version='1.0' encoding='utf-8'?>";
    szInfo += "<SnapPolygonList>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>1</id>";
    szInfo += "<polygonType>1</polygonType>";
    szInfo += "<tips>#1#Setting 1</tips>";
    szInfo += "<isClosed>true</isClosed>";
    szInfo += "<color><r>0</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList>";
    szInfo += "<point><x>0.737903</x><y>0.229730</y></point>";
    szInfo += "<point><x>0.947581</x><y>0.804054</y></point>";
    szInfo += "<point><x>0.362903</x><y>0.777027</y></point>";
    szInfo += "</pointList>";
    szInfo += "</SnapPolygon>";
    szInfo += "<SnapPolygon>";
    szInfo += "<id>2</id>";
    szInfo += "<polygonType>0</polygonType>";
    szInfo += "<tips>#2#Setting 2</tips>";
    szInfo += "<isClosed>true</isClosed>";
    szInfo += "<color><r>255</r><g>255</g><b>0</b></color>";
    szInfo += "<pointList>";
    szInfo += "<point><x>0.2</x><y>0.2</y></point>";
    szInfo += "<point><x>0.8</x><y>0.2</y></point>";
    szInfo += "<point><x>0.8</x><y>0.8</y></point>";
    szInfo += "<point><x>0.2</x><y>0.8</y></point>";
    szInfo += "</pointList>";
    szInfo += "</SnapPolygon>";
    szInfo += "</SnapPolygonList>";

    WebVideoCtrl.I_SetSnapPolygonInfo(g_iWndIndex, szInfo).then(() => {
        showOPInfo("Shapes set successfully!");
    }, (oError) => {
        showOPInfo("Failed to set shapes!", oError.errorCode, oError.errorMsg);
    });
}

// Clear Shapes
function clickDelAllSnapPolygon() {
    if (!g_bEnableDraw) {
        return;
    }

    WebVideoCtrl.I_ClearSnapInfo(g_iWndIndex).then(() => {
        showOPInfo("All shapes cleared successfully!");
    }, (oError) => {
        showOPInfo("Failed to clear shapes!", oError.errorCode, oError.errorMsg);
    });
}

// Device Capture Image
function clickDeviceCapturePic() {
    var szInfo = "";
    var szDeviceIdentify = $("#ip").val();
    var bZeroChannel = $("#channels option").eq($("#channels").get(0).selectedIndex).attr("bZero") == "true" ? true : false;
    var iChannelID = parseInt($("#channels").val(), 10);
    var iResolutionWidth = parseInt($("#resolutionWidth").val(), 10);
    var iResolutionHeight = parseInt($("#resolutionHeight").val(), 10);

    if (null == szDeviceIdentify) {
        return;
    }

    if (bZeroChannel) { // Zero channel does not support device image capture
        return;
    }

    var szPicName = szDeviceIdentify + "_" + iChannelID + "_" + new Date().getTime();
    var iRet = WebVideoCtrl.I_DeviceCapturePic(szDeviceIdentify, iChannelID, szPicName, {
        iResolutionWidth: iResolutionWidth,
        iResolutionHeight: iResolutionHeight
    });

    if (0 == iRet) {
        szInfo = "Device image capture successful!";
    } else {
        szInfo = "Device image capture failed!";
    }
    showOPInfo(szDeviceIdentify + " " + szInfo);
}

function loadXML(szXml) {
    if (null == szXml || "" == szXml) {
        return null;
    }

    var oXmlDoc = null;

    if (window.DOMParser) {
        var oParser = new DOMParser();
        oXmlDoc = oParser.parseFromString(szXml, "text/xml");
    } else {
        oXmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        oXmlDoc.async = false;
        oXmlDoc.loadXML(szXml);
    }

    return oXmlDoc;
}

function toXMLStr(oXmlDoc) {
    var szXmlDoc = "";

    try {
        var oSerializer = new XMLSerializer();
        szXmlDoc = oSerializer.serializeToString(oXmlDoc);
    } catch (e) {
        try {
            szXmlDoc = oXmlDoc.xml;
        } catch (e) {
            return "";
        }
    }
    if (szXmlDoc.indexOf("<?xml") == -1) {
        szXmlDoc = "<?xml version='1.0' encoding='utf-8'?>" + szXmlDoc;
    }

    return szXmlDoc;
}

function encodeString(str) {
    if (str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } else {
        return "";
    }
}