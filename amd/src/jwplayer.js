// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * JW Player module.
 *
 * @module     media_jwplayer/jwplayer
 * @package    media_jwplayer
 * @copyright  2017 Ruslan Kabalin, Lancaster University
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jwplayer', 'jquery', 'core/ajax', 'core/log', 'module'], function(jwplayer, $, ajax, log, module) {
    var player = {
        /** @var {Number} context ID of the page. */
        context: null,

        /** @var {Object} events map. */
        eventMap: {
            started:   'firstFrame',
            paused:    'pause',
            seeked:    'seek',
            resumed:   'play',
            completed: 'complete',
            failed:    'error'
        },

        /** @var {Object} requested events map. */
        reqEventMap: {},

        /**
         * Initialise the player instance.
         *
         * @method  init
         * @param   {Object} playerSetup JW Player setup parameters.
         * @param   {String} playerId    JW Player target element id.
         * @param   {Number} context     The context of the current page.
         */
        init: function (playerSetup, playerId, context) {
            player.context = context;

            if (!$('#' + playerId).length) {
                throw new Error('The target element for player setup (#' + playerId + ') is missing.');
            }

            if (module.config().licensekey) {
                jwplayer.key = module.config().licensekey;
            }

            let playerinstance = jwplayer(playerId);
            // Setup player.
            playerinstance.setup(playerSetup.setupdata);

            // Add download button if required.
            if (typeof(playerSetup.downloadbtn) !== 'undefined') {
                playerinstance.addButton(playerSetup.downloadbtn.img, playerSetup.downloadbtn.tttext, function() {
                    // Grab the file that's currently playing.
                    window.open(playerinstance.getPlaylistItem().file + '?forcedownload=true');
                }, "download");
            }

            // Track required events and log them in Moodle.
            playerSetup.events.forEach(function (eventName) {
                if (typeof player.getEventName(eventName) === 'undefined') {
                    throw new Error("Event tracking for '" + eventName + "' has no JWPlayer API event mapping.");
                }
                player.reqEventMap[player.getEventName(eventName)] = eventName;
                if (player.getEventName(eventName) !== 'error') {
                    // Attach event processing callbacks.
                    playerinstance.on(player.getEventName(eventName), player.logEvent);
                }
            });

            // Track errors and log them.
            playerinstance.on('error', player.logError);
            playerinstance.on('setupError', function(event) {
                // For setup error just log to console.
                log.error('media_jwplayer setup error: ' + event.message);
            });
        },

        /**
         * Event mapping helper.
         *
         * @method getEventName
         * @param  {String} mdlEventName media_jwplayer plugin event.
         * @return {String}
         */
        getEventName: function(mdlEventName) {
            return player.eventMap[mdlEventName];
        },

        /**
         * Event logging.
         *
         * @method logEvent
         * @param  {Object} event JW Player event.
         */
        logEvent: function(event) {
            if (event.type === 'play' && event.playReason !== 'interaction') {
                // Play event resulted not from user action, skipping.
                return;
            }
            if (event.type === 'pause' && event.pauseReason !== 'interaction') {
                // Pause event resulted not from user action, skipping.
                return;
            }

            let args = {
                context:    player.context,
                event:      player.reqEventMap[event.type],
                title:      this.getPlaylistItem().file,
                position:   parseInt(this.getPosition())
            };

            if (typeof this.getPlaylistItem().title !== 'undefined') {
                // If title is defined, use it.
                args.title = this.getPlaylistItem().title;
            }

            if (event.type === 'seek') {
                // Offset is only valid for 'seek' event.
                args.offset = parseInt(event.offset);
            }

            // Perform webservice call.
            $.when(
                ajax.call([
                    {
                        methodname: 'media_jwplayer_playback_event',
                        args: args
                    }
                ])[0]
            ).fail(log.error);
        },

        /**
         * Error logging.
         *
         * @method logError
         * @param  {Object} event JW Player event.
         */
        logError: function(event) {
            log.error('media_jwplayer error: ' + event.message);

            if (typeof player.reqEventMap.error !== 'undefined') {
                // Event needs to be relayed.
                let args = {
                    context:    player.context,
                    title:      this.getPlaylistItem().file,
                    position:   parseInt(this.getPosition()),
                    code:       event.code,
                    message:    event.message
                };

                if (typeof this.getPlaylistItem().title !== 'undefined') {
                    // If title is defined, use it.
                    args.title = this.getPlaylistItem().title;
                }

                // Perform webservice call.
                $.when(
                    ajax.call([
                        {
                            methodname: 'media_jwplayer_playback_failed',
                            args: args
                        }
                    ])[0]
                ).fail(log.error);
            }
        }
    };

    return /** @alias module:media_jwplayer/jwplayer */ {
        /**
         * Setup player instance.
         *
         * @method  setupPlayer
         * @param   {Object} playerSetup JW Player setup parameters.
         * @param   {String} playerId    JW Player target element id.
         * @param   {Number} context     The context of the current page.
         */
        setupPlayer: player.init
    };
});