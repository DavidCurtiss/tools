// ==UserScript==
// @name         Codesearch enhancements
// @version      0.1
// @author       David Curtiss (NI)
// @description  Workflow improvements for codesearch
// @license      MIT

// @namespace    https://github.com/DavidCurtiss/tools
// @homepageURL  https://github.com/DavidCurtiss/tools/tree/main/userscripts
// @downloadURL  https://raw.githubusercontent.com/DavidCurtiss/tools/refs/heads/main/userscripts/codesearch-enhancements.user.js
// @updateURL    https://raw.githubusercontent.com/DavidCurtiss/tools/refs/heads/main/userscripts/codesearch-enhancements.user.js
// @contributionURL  https://github.com/DavidCurtiss/tools/tree/main/userscripts

// @include      https://codesearch.natinst.com/*
// @include      https://codesearch.ni.systems/*

// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

function getFiles() {
    const files = {};
    let sum = 0;
    $(".file-group").each(function (i, elem) {
        const fname = $(elem).children(".header").text();
        const matches = $(elem).find(".matchstr");
        files[fname] = matches.length;
        sum += matches.length;
    });
    console.log("sum", sum);
    return files;
}
function dump() {
    const search = $("#searchbox").val();
    const result = {}
    result[search] = getFiles();
    return result;
}
function autoDump() {
    if ($("#searchbox").val() != "") {
        //GM_setClipboard(JSON.stringify(dump(), undefined, "    "));
    }
}
unsafeWindow.getFiles = getFiles;
unsafeWindow.dump = dump;

/*
function getQueryVariable(variable) {
    const query = window.location.search.substring(1);
    const vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

function getArrayQueryVariable(variable) {
    const query = window.location.search.substring(1);
    const vars = query.split('&');
    const matches = [];
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            matches.push(decodeURIComponent(pair[1]));
        }
    }
    return matches;
}
*/

const INITIAL_SEARCH_STRING = window.location.search;

function addQueryKeyValuePair(key, value) {
    let url = window.location.pathname + window.location.search;
    url += (window.location.search ? "&" : "?") + encodeURIComponent(key) + "=" + encodeURIComponent(value);
    history.pushState(null, "", url);
}

function removeQueryKeyValuePair(key, value) {
    const query = window.location.search.substring(1);
    const vars = query.split('&');
    const toRemove = encodeURIComponent(key) + "=" + encodeURIComponent(value);
    vars.splice(vars.indexOf(toRemove), 1);

    let url = window.location.pathname;
    if (vars.length) {
        url += "?" + vars.join("&");
    }
    history.pushState(null, "", url);
}

function getEnabledRepos() {
    const repos = [];
    const queryString = window.location.search.substring(1);
    queryString.split('&').forEach(function(v) {
        if (v.startsWith(encodeURIComponent("repo[]") + "=")) {
            repos.push(decodeURIComponent(v.replace(/.*?=/, "")));
        }
    });
    return repos;
}

function setQueryStringReposFromCookie() {
    const cookiePrefs = Cookies.getJSON('prefs');
    if (cookiePrefs === undefined || cookiePrefs.repos === undefined) {
        return;
    }

    const query = window.location.search.substring(1);
    const vars = query.length ? query.split('&') : [];
    const key = encodeURIComponent("repo[]");
    for (let i = vars.length - 1; i >= 0; --i) {
        if (vars[i].startsWith(key + "=")) {
            vars.splice(i, 1);
        }
    }
    cookiePrefs.repos.forEach(function (repo) {
        vars.push(key + "=" + encodeURIComponent(repo));
    });
    const newSearchString = vars.length ? ("?" + vars.join("&")) : "";
    if (newSearchString != window.location.search) {
        history.replaceState(null, "", window.location.pathname + newSearchString);
    }
}

function saveReposToCookie() {
    const repos = getEnabledRepos();
    const cookiePrefs = Cookies.getJSON('prefs') || {};
    cookiePrefs.repos = repos;
    Cookies.set('prefs', JSON.stringify(cookiePrefs));
}

function repoToClassName(repo) {
    return btoa(repo).replace(/=/g, "_e").replace(/\+/g, "_p").replace(/\//g, "_s");
}

function repoToShortName(repo) {
    const m = repo.match(/^([^\/]+)\/(\1)\/main$/i);
    if (m) {
        return m[2];
    }
    return repo;
}

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

function getRepoByHash(hash, repos) {
    for (const repo of repos) {
        if (hashString(repo) == hash) {
            return repo;
        }
    }
    return null;
}

function setRepoToggleEnabled(repo, enabled) {
    const repoToggleSelector = ".toggleRepo." + repoToClassName(repo);
    if (enabled === undefined) {
        enabled = getEnabledRepos().indexOf(repo) >= 0;
    }
    if (enabled) {
        const TOGGLED_ON_BG_COLOR = "#AAAAAA";
        $(repoToggleSelector).css("background-color", TOGGLED_ON_BG_COLOR);
    } else {
        $(repoToggleSelector).css("background-color", "transparent");
    }
}

function addRepoToggle(repo, enabled) {
    const repoToggleSelector = ".toggleRepo." + repoToClassName(repo);
    if ($(repoToggleSelector).length == 0) {
        const reposDiv = $("#repoToggles");
        reposDiv.append($('<code class="toggleRepo ' + repoToClassName(repo) + '" x-repo="' + repo + '">' + repoToShortName(repo) + '</code>'));
        reposDiv.append(" ");
    }
    setRepoToggleEnabled(repo, enabled);
}

function updateRepoToggles() {
    // Always add core repos first
    const allRepos = Object.keys(scriptData.repo_urls.text);
    const reposToAlwaysAdd = [ // hashed to hide internal repo names
        2307489890, 2252721566, 2273129866, 4082710428
    ];
    for (const hash of reposToAlwaysAdd) {
        const repo = getRepoByHash(hash, allRepos);
        if (repo) {
            addRepoToggle(repo);
        }
    }
    // Add enabled repos
    const enabledRepos = getEnabledRepos();
    enabledRepos.forEach(function(repo) {
        addRepoToggle(repo);
    });
    // Remove highlight of any repoToggles that are no longer enabled
    $(".toggleRepo").each(function(i, t) {
        const repo = $(t).attr("x-repo");
        if (enabledRepos.indexOf(repo) == -1) {
            setRepoToggleEnabled(repo, false);
        }
    });
}

function toggleRepo(repo) {
    const repoToggleSelector = ".toggleRepo." + repoToClassName(repo);
    const repos = getEnabledRepos();
    if (repos.indexOf(repo) >= 0) {
        removeQueryKeyValuePair("repo[]", repo);
        setRepoToggleEnabled(repo, false);
    } else {
        addQueryKeyValuePair("repo[]", repo);
        setRepoToggleEnabled(repo, true);
    }
    saveReposToCookie();
    window.onpopstate(); // tell codesearch to apply the new filter
    $("#searchbox").focus();
    /*
    const searchbox = $("#searchbox");
    let text = searchbox.val();
    text = "repo:" + repo + " " + text;
    searchbox.val(text);
    searchbox.trigger("paste");
    */
}

function initRepos() {
    const appendTo = $("div.query-hint");
    $("<div>&nbsp;</div>").appendTo(appendTo);
    const reposDiv = $('<div id="repoToggles">Toggle repo: </div>');
    reposDiv.appendTo(appendTo);
    if (INITIAL_SEARCH_STRING) {
        history.replaceState(null, "", window.location.pathname + INITIAL_SEARCH_STRING);
    } else {
        history.replaceState(null, "", window.location.pathname + "?regex=true");
        setQueryStringReposFromCookie();
        window.onpopstate(); // tell codesearch to apply the new filter
    }
    cookieStore.addEventListener("change", (event) => {
        setQueryStringReposFromCookie();
    });
    updateRepoToggles();
}

function addCollapseButtons() {
    $(".file-group-collapser").remove();
    $(".file-group > .result-path").before('<div class="file-group-collapser"><span class="arrow-down"></span></div>');
    //$(".file-group");
}

function onLoad() {
    if (typeof($) == "undefined" || typeof(Cookies) == "undefined") {
        setTimeout(onLoad, 100);
        return;
    }

    setTimeout(function() { initRepos(); }, 0);
    addEventListener("popstate", () => {
        saveReposToCookie();
        updateRepoToggles();
    });

    addCollapseButtons();
    autoDump();
    const mutationObserver = new MutationObserver(function(mutations, observer) {
        updateRepoToggles();
        addCollapseButtons();
        autoDump();
    });
    mutationObserver.observe(document.getElementById("results"), { childList: true });

    $("body").on("click", ".toggleRepo", function (event) {
        toggleRepo($(event.target).attr("x-repo"));
    });
    $("body").on("click", ".file-group-collapser", function (event) {
        const fileGroup = $(event.target).parents(".file-group");
        if (fileGroup.hasClass("collapsed")) {
            fileGroup.removeClass("collapsed");
        } else {
            fileGroup.addClass("collapsed");
        }
    });
}

(function() {
    'use strict';

    GM_addStyle('.file-group-collapser { float: left; padding-left: 5px; padding-top: 7px; }');
    GM_addStyle('.arrow-down { display: inline-block; width: 0; height: 0; border-left: 0.6em solid transparent; border-right: 0.6em solid transparent; border-top: 0.6em solid #AAAAAA; }');
    GM_addStyle('.file-group.collapsed > .match { display: none }');
    GM_addStyle('.file-group.collapsed > .file-group-collapser .arrow-down { transform: rotate(-90deg) translateX(0px); }');

    onLoad();
})();
