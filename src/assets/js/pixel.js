/*
=========================================================
* Pixel Free Bootstrap 5 UI Kit
=========================================================

* Product Page: https://themesberg.com/product/ui-kit/pixel-free-bootstrap-5-ui-kit
* Copyright 2021 Themesberg
* Coded by https://themesberg.com
=========================================================
*/

"use strict";

import Vivus from "vivus";
import Headroom from "headroom.js";
import SmoothScroll from "smooth-scroll";
import SimpleBar from "simplebar";

const d = document;

d.addEventListener("DOMContentLoaded", function(event) {

    document.querySelectorAll("[data-simplebar]").forEach((el) => {
        if (!el.SimpleBar) new SimpleBar(el); // Prevent double init
    });

    const breakpoints = {
        sm: 540,
        md: 720,
        lg: 960,
        xl: 1140
    };
    
    var preloader = d.querySelector('.preloader');
    if(preloader) {
        const animations = ['oneByOne', 'delayed', 'sync', 'scenario'];
        new Vivus('loader-logo', {duration: 80, type: 'oneByOne'}, function () {});
        setTimeout(function() {
            preloader.classList.add('show');
        }, 1500);
    }

    if (d.querySelector('.headroom')) {
        var headroom = new Headroom(document.querySelector("#navbar-main"), {
            offset: 0,
            tolerance: { up: 0, down: 0 },
        });
        headroom.init();
    }

    [].slice.call(d.querySelectorAll('[data-background]')).map(function(el) {
        el.style.background = 'url(' + el.getAttribute('data-background') + ')';
    });

    [].slice.call(d.querySelectorAll('[data-background-color]')).map(function(el) {
        el.style.background = 'url(' + el.getAttribute('data-background-color') + ')';
    });

    [].slice.call(d.querySelectorAll('[data-color]')).map(function(el) {
        el.style.color = 'url(' + el.getAttribute('data-color') + ')';
    });

    // Tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });

    // Datepicker
    var datepickers = [].slice.call(document.querySelectorAll('[data-datepicker]'));
    var datepickersList = datepickers.map(function (el) {
        return new Datepicker(el, {
            buttonClass: 'btn'
        });
    });

    // Toasts
    var toastElList = [].slice.call(document.querySelectorAll('.toast'));
    var toastList = toastElList.map(function (toastEl) {
        return new bootstrap.Toast(toastEl);
    });

    var scroll = new SmoothScroll('a[href*="#"]', {
        speed: 500,
        speedAsDuration: true
    });

    if (d.querySelector('.current-year')) {
        d.querySelector('.current-year').textContent = new Date().getFullYear();
    }

    var sidebar = document.getElementById('sidebarMenuQue')
    if(sidebar && d.body.clientWidth < breakpoints.lg) {
        sidebar.addEventListener('shown.bs.collapse', function () {
            document.querySelector('body').style.position = 'fixed';
        });
        sidebar.addEventListener('hidden.bs.collapse', function () {
            document.querySelector('body').style.position = 'relative';
        });
    }

    if(sidebar) {
        if (localStorage.getItem('sidebar') === 'contracted') {
            sidebar.classList.add('contracted');
        } else {
            sidebar.classList.remove('contracted');
        }
    
        var sidebarToggle = d.getElementById('sidebar-toggle');
        sidebarToggle.addEventListener('click', function () {
            if (sidebar.classList.contains('contracted')) {
                sidebar.classList.remove('contracted');
                localStorage.removeItem('sidebar', 'contracted');
            } else {
                sidebar.classList.add('contracted');
                localStorage.setItem('sidebar', 'contracted');
            }
        });
    
        sidebar.addEventListener('mouseenter', function() {
            if (localStorage.getItem('sidebar') === 'contracted') {
                if (sidebar.classList.contains('contracted')) {
                    sidebar.classList.remove('contracted');
                } else {
                    sidebar.classList.add('contracted');
                }
            }
        });
    
        sidebar.addEventListener('mouseleave', function() {
            if (localStorage.getItem('sidebar') === 'contracted') {
                if (sidebar.classList.contains('contracted')) {
                    sidebar.classList.remove('contracted');
                } else {
                    sidebar.classList.add('contracted');
                }
            }
        });
    }

});
