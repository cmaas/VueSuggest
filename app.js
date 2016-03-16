/**
 * JSONP response wrapper.
 */
function pr(response) {
    app.handleSuggestionResponse(response);
}

/**
 * Try to detect the browser language for an initial set of keyword suggestion strategies.
 * Currently supported: en, de
 */
var browserLang = window.navigator.userLanguage || window.navigator.language;

/**
 * Array to newline-separated string
 */
Vue.filter('join', function (values) {
    return values.join("\n");
})

/**
 * Row that contain suggestions for a keyword.
 */
Vue.component('suggestion-result', {
    template: '#suggestion-result-template',
    props: {
        keyword: String,
        suggestions: Array
    }
});

/**
 * The main Vue app.
 */
var app = new Vue({
    
    el: '#app',

    data: {
        strategies: [],
        selectedStrategyName: '',
        keyword: '',
        lang: browserLang || 'en',
        suggestionResults: [],
        batchSize: 10,
        batchDelay: 200,
        batchPause: 10000,
        executed: 0
    },

    created: function () {
        this.strategies = this.makeStrategies(this.lang);
        this.selectedStrategyName = this.strategies[0].name;
    },

    watch: {
        // watch 'lang' instead of making this a computed property,
        // because it shouldn't change at all, unless the user manually changes it in the console
        lang: function (newVal) {
            this.selectedStrategyName = this.strategies[0].name;
            this.strategies = this.makeStrategies(newVal);
            console.log('lang changed to ' + newVal + '. refreshed strategies');
        }
    },

    computed: {
        numRequests: function () {
            if (!this.keyword) {
                return 0;
            }
            return this.selectedStrategy.items.length;
        },
        selectedStrategy: function () {
            var s = this.strategies.filter(function(item) {
                return item.name === this.selectedStrategyName;
            }.bind(this));
            return s.pop();
        },
        suggestionResultsRaw: function() {
            var all = [];
            for (var i = 0; i < this.suggestionResults.length; i++) {
                all = all.concat(this.suggestionResults[i].suggestions);
            }
            return all.join("\n");
        },
        suggestionResultsCount: function () {
            return this.suggestionResults.reduce(function(total, item) {
                return total + item.suggestions.length;
            }, 0);
        }
    },

    methods: {
        /**
         * Create appendices for a keyword based on the selected language.
         */
        makeStrategies: function (lang) {
            var a = [
            {
                name: '- no appendix -',
                items: ['']
            },
            {
                name: 'a-z 0-9',
                items: [
                ' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
                'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
                'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
            }];
            if (lang === 'de') {
                a.push({
                    name: '6 W-Fragen',
                    items: [
                        'was', 'wer', 'wie', 'wo', 'wann', 'warum'
                    ]
                });
            }
            else {
                a.push({
                    name: '6 Questions',
                    items: [
                        'how', 'why', 'when', 'what', 'who', 'where'
                    ]
                });
            }
            return a;
        },

        /**
         * Remove all used script tags like bullet shells after we fired.
         */
        cleanUp: function () {
            // clear old script tags
            document.getElementById("script-container").innerHTML = '';
            this.executed = 0;
        },

        /**
         * Batch-process suggestions based on keyword + appendices (called 'strategy').
         */
        getSuggestions: function (event) {
            if (!this.keyword || !this.selectedStrategy) {
                return false;
            }

            this.cleanUp();

            for (var i = 0; i < this.selectedStrategy.items.length; i++) {
                var appendix = this.selectedStrategy.items[i],
                    kw = this.keyword + ' ' + appendix.trim(),
                    timeout = (i % this.batchSize) * this.batchDelay + Math.floor(i / this.batchSize) * this.batchPause;
                console.log("queueing suggestions for: '" + kw + "' (delay: " + timeout + "ms)");                    
                this.getSuggestion(kw, timeout);
            }            
        },

        /**
         * Put the keyword in a callback which is triggered after a given delay.
         */
        getSuggestion: function (kw, delay) {
            var self = this;
            setTimeout(function() {
                self.executeGetSuggestion(kw);
            }, delay);
        },

        /**
         * Do the actual request to Google's API.
         * Important: We can't use AJAX here, since Cross-Origin Resource Sharing isn't allowed.
         * So we use a workaround: Google's Suggest API allows a JSONP callback. We include the response in a <script> tag
         * and let the JSONP response handler take care of the rest.
         */
        executeGetSuggestion: function (kw) {
            this.executed++;
            var s = document.createElement('script');
            s.src = '//suggestqueries.google.com/complete/search?output=firefox&hl='+this.lang+'&q='+encodeURI(kw)+'&jsonp=pr';
            s.onerror = self.handleRequestError;
            s.async = true;
            document.getElementById("script-container").appendChild(s);
        },

        handleRequestError: function () {
            console.log('request error, see network log in your browser');
        },

        /**
         * Called by JSONP response handler. Processes the received suggestions.
         */
        handleSuggestionResponse: function (response) {
            var kw = response[0],
                suggestions = response[1];
            console.log("received response for '"+kw+"'");
            this.suggestionResults.push({
                keyword: kw,
                suggestions: suggestions
            });
        }
    }
});
