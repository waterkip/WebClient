// TODO: inject proton.constants everywhere

angular.module("proton.routes", [
    "ui.router",
    "proton.authentication",
    "proton.constants"
])

.config(function($stateProvider, $urlRouterProvider, $locationProvider, CONSTANTS) {

    var messageViewOptions = {
        url: "/:id",
        onEnter: function($rootScope) {
            $rootScope.isInMailbox = true;
        },
        onExit: function($rootScope) {
            $rootScope.isInMailbox = false;
        },
        controller: "ViewMessageController as messageViewCtrl",
        templateUrl: "templates/views/message.tpl.html",
        resolve: {
            message: function(
                $rootScope,
                $state,
                $stateParams,
                Message,
                messageCache,
                authentication,
                networkActivityTracker
            ) {
                if (authentication.isLoggedIn()) {
                    return networkActivityTracker.track(
                        messageCache.get($stateParams.id).$promise
                    );
                }
            }
        }
    };

    var messageParameters = function() {
      var parameters = [
        'page',
        'filter',
        'sort',
        'location',
        'label',
        'from',
        'to',
        'subject',
        'words',
        'begin',
        'end',
        'attachments',
        'starred'
      ];

      return parameters.join('&');
    };

    var messageListOptions = function(url, params) {
        var opts = _.extend(params || {}, {
            url: url + "?" + messageParameters(),
            views: {
                "content@secured": {
                    controller: "MessageListController as messageListCtrl",
                    templateUrl: "templates/views/messageList.tpl.html"
                }
            },

            onEnter: function($rootScope) {
                $rootScope.isInMailbox = true;
            },
            onExit: function($rootScope) {
                $rootScope.isInMailbox = false;
            },

            resolve: {
                messages: function(
                    $state,
                    $stateParams,
                    $rootScope,
                    authentication,
                    Label,
                    Message,
                    CONSTANTS,
                    networkActivityTracker,
                    errorReporter
                ) {
                    var mailbox = this.data.mailbox;

                    if (authentication.isSecured()) {
                        var page =  $stateParams.page || 1;
                        var params = {
                            "Location": CONSTANTS.MAILBOX_IDENTIFIERS[mailbox],
                            "Page": page - 1
                        };

                        if ($stateParams.filter) {
                            params.Unread = +($stateParams.filter === 'unread');
                        }

                        if ($stateParams.sort) {
                            var sort = $stateParams.sort;
                            var desc = _.string.startsWith(sort, "-");

                            if (desc) {
                                sort = sort.slice(1);
                            }

                            params.Sort = _.string.capitalize(sort);
                            params.Desc = +desc;
                        }

                        var messagesPromise;

                        if (mailbox === 'search') {
                            delete params.Location;
                            params.Location = $stateParams.location;
                            params.Keyword = $stateParams.words;
                            params.To = $stateParams.to;
                            params.From = $stateParams.from;
                            params.Subject = $stateParams.subject;
                            params.Begin = $stateParams.begin;
                            params.End = $stateParams.end;
                            params.Attachments = $stateParams.attachments;
                            params.Starred = $stateParams.starred;
                            params.Label = $stateParams.label;
                        } else if(mailbox === 'label') {
                            delete params.Location;
                            params.Label = $stateParams.label;
                        }

                        _.pick(params, _.identity);

                        messagesPromise = Message.query(params).$promise;

                        return networkActivityTracker.track(
                            errorReporter.resolve(
                                "Messages couldn't be queried - please try again later.",
                                messagesPromise, []
                            )
                        );
                    } else {
                        return [];
                    }
                }
            }
        });
        return opts;
    };

    $stateProvider

    // ------------
    // LOGIN ROUTES
    // ------------
    .state("login", {
        url: "/login",
        views: {
            "main@": {
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@login": {
                controller: "LoginController",
                templateUrl: "templates/views/login.tpl.html"
            }
        }
    })

    .state("login.unlock", {
        url: "/unlock",
        views: {
            "panel@login": {
                controller: "LoginController",
                templateUrl: "templates/views/unlock.tpl.html"
            }
        },
        onEnter: function() {
            setTimeout( function() {
                $('input[name="MailboxPassword"').focus();
            }, 500);
        }
    })

    // -------------------------------------------
    // ACCOUNT ROUTES
    // -------------------------------------------
    .state("account", {
        url: "/account/:username/:token",
        resolve: {
            app: function($stateParams, $state, $q, User) {
                var defer = $q.defer();

                User.checkInvite({
                    username: $stateParams.username,
                    token: $stateParams.token
                }).$promise.then(function(response) {
                    defer.resolve();
                }, function(response) {
                    defer.reject(response);
                });

                return defer.promise;
            }
        },
        views: {
            "main@": {
                controller: "AccountController",
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@account": {
                templateUrl: "templates/views/sign-up.tpl.html"
            }
        }
    })

    .state("signup", {
        url: "/signup",
        views: {
            "main@": {
                controller: "AccountController",
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@signup": {
                templateUrl: "templates/views/sign-up.tpl.html"
            }
        }
    })

    .state("step1", {
        url: "/create/new",
        views: {
            "main@": {
                controller: "AccountController",
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@step1": {
                templateUrl: "templates/views/step1.tpl.html"
            }
        },
        resolve: {
            app: function(authentication, $state, $rootScope) {
                if (authentication.isLoggedIn()) {
                    return authentication.fetchUserInfo().then(
                    function() {
                        $rootScope.pubKey = authentication.user.PublicKey;
                        $rootScope.user = authentication.user;
                        $rootScope.user.DisplayName = authentication.user.addresses[0].Email;
                        if ($rootScope.pubKey === 'to be modified') {
                            $state.go('step2');
                            return;
                        } else {
                            $state.go("login.unlock");
                            return;
                        }
                    });
                }
                else {
                    return;
                }
            }
        }
    })

    .state("step2", {
        url: "/create/mbpw",
        views: {
            "main@": {
                controller: "AccountController",
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@step2": {
                templateUrl: "templates/views/step2.tpl.html"
            }
        },
        onEnter: function(authentication, $state, $rootScope) {
            if (authentication.isLoggedIn()) {
                $rootScope.isLoggedIn = true;
                return authentication.fetchUserInfo().then(
                function() {
                    $rootScope.user = authentication.user;
                    $rootScope.pubKey = authentication.user.PublicKey;
                    $rootScope.user.DisplayName = authentication.user.addresses[0].Email;
                    if ($rootScope.pubKey === 'to be modified') {
                        return;
                    } else {
                        $state.go("login.unlock");
                        return;
                    }
                });
            }
            else {
                $state.go("login");
                return;
            }
        }
    })

    .state("reset", {
        url: "/reset",
        views: {
            "main@": {
                controller: "AccountController",
                templateUrl: "templates/layout/auth.tpl.html"
            },
            "panel@reset": {
                templateUrl: "templates/views/reset.tpl.html"
            }
        },
        resolve: {
            // Contains also labels and contacts
            user: function(authentication) {
                return authentication.fetchUserInfo();
            }
        }
    })

    // -------------------------------------------
    // SUPPORT ROUTES
    // -------------------------------------------
    .state("support", {
        url: "/support",
        views: {
            "main@": {
                controller: "SupportController",
                templateUrl: "templates/layout/auth.tpl.html"
            }
        }
    })

    .state("support.message", {
        params: {
            data: null
        }, // Tip to avoid passing parameters in the URL
        url: "/message",
        onEnter: function($state, $stateParams) {
            if ($stateParams.data === null) {
                $state.go('login');
            }
        },
        views: {
            "panel@support": {
                templateUrl: "templates/views/support-message.tpl.html"
            }
        }
    })

    .state("support.reset-password", {
        url: "/reset-password",
        views: {
            "panel@support": {
                templateUrl: "templates/views/reset-password.tpl.html"
            }
        }
    })

    .state("support.confirm-new-password", {
        url: "/confirm-new-password/:token",
        onEnter: function($stateParams, $state, User) {
            var token = $stateParams.token;

            // Check if reset token is valid
            User.checkResetToken({
                token: token
            }).$promise.catch(function(result) {
                if (result.error) {
                    $state.go("support.message", {
                        data: {
                            title: result.error,
                            content: result.error_description,
                            type: "alert-danger"
                        }
                    });
                }
            });
        },
        views: {
            "panel@support": {
                templateUrl: "templates/views/confirm-new-password.tpl.html"
            }
        }
    })

    // -------------------------------------------
    // ENCRYPTION OUTSIDE
    // -------------------------------------------
    .state("eo", {
        abstract: true,
        views: {
            "main@": {
                templateUrl: "templates/layout/outside.tpl.html"
            }
        },
    })

    .state("eo.unlock", {
        url: "/eo/:tag",
        resolve: {
            encryptedToken: function(Eo, $stateParams) {
                return Eo.token($stateParams.tag);
            }
        },
        views: {
            "content": {
                templateUrl: "templates/views/outside.unlock.tpl.html",
                controller: function($scope, $state, $stateParams, pmcw, encryptedToken, networkActivityTracker) {
                    encryptedToken = encryptedToken.data.Token;

                    $scope.unlock = function() {
                        var promise = pmcw.decryptMessage(encryptedToken, $scope.MessagePassword);

                        promise.then(function(decryptedToken) {
                            window.sessionStorage["proton:decrypted_token"] = decryptedToken;
                            window.sessionStorage["proton:encrypted_password"] = pmcw.encode_utf8_base64($scope.MessagePassword);
                            $state.go('eo.message', {tag: $stateParams.tag});
                        });

                        networkActivityTracker.track(promise);
                    };
                }
            }
        }
    })

    .state("eo.message", {
        url: "/eo/message/:tag",
        resolve: {
            message: function($stateParams, $q, Eo, pmcw) {
                var deferred = $q.defer();
                var token_id = $stateParams.tag;
                var decrypted_token = window.sessionStorage["proton:decrypted_token"];
                var password = pmcw.decode_utf8_base64(window.sessionStorage["proton:encrypted_password"]);

                Eo.message(decrypted_token, token_id).then(function(result) {
                    var message = result.data.Message;

                    pmcw.decryptMessageRSA(message.Body, password, message.Time).then(function(body) {
                        message.Body = body;

                        deferred.resolve(message);
                    });
                });

                return deferred.promise;
            }
        },
        views: {
            "content": {
                templateUrl: "templates/views/outside.message.tpl.html",
                controller: function($scope, $state, $stateParams, $sce, $timeout, message, tools) {
                    $scope.message = message;

                    var content = $scope.message.Body;

                    content = tools.clearImageBody(content);
                    $scope.imagesHidden = true;
                    content = tools.replaceLineBreaks(content);
                    content = DOMPurify.sanitize(content, { FORBID_TAGS: ['style'] });

                    $scope.content = content;

                    $timeout(function() {
                        tools.transformLinks('message-body');
                        $scope.containsImage = tools.containsImage(content);
                    });

                    $scope.reply = function() {
                        $state.go('eo.reply', {tag: $stateParams.tag});
                    };

                    $scope.toggleImages = function() {
                        if($scope.imagesHidden === true) {
                            $scope.content = tools.fixImages($scope.content);
                        } else {
                            $scope.content = tools.breakImages($scope.content);
                        }
                    };
                }
            }
        }
    })

    .state("eo.reply", {
        url: "/eo/reply/:tag",
        resolve: {
            message: function($stateParams, $q, Eo, pmcw) {
                var deferred = $q.defer();
                var token_id = $stateParams.tag;
                var decrypted_token = window.sessionStorage["proton:decrypted_token"];
                var password = pmcw.decode_utf8_base64(window.sessionStorage["proton:encrypted_password"]);

                Eo.message(decrypted_token, token_id).then(function(result) {
                    var message = result.data.Message;

                    pmcw.decryptMessageRSA(message.Body, password, message.Time).then(function(body) {
                        message.Body = body;

                        deferred.resolve(message);
                    });
                });

                return deferred.promise;
            }
        },
        views: {
            "content": {
                templateUrl: "templates/views/outside.reply.tpl.html",
                controller: function($scope, message) {
                    $scope.message = message;

                    $scope.send = function() {

                    };
                }
            }
        }
    })

    // -------------------------------------------
    // SECURED ROUTES
    // this includes everything after login/unlock
    // -------------------------------------------

    .state("secured", {
        // This is included in every secured.* sub-controller
        abstract: true,
        views: {
            "main@": {
                controller: "SecuredController",
                templateUrl: "templates/layout/secured.tpl.html"
            }
        },
        resolve: {
            // Contains also labels and contacts
            user: function(authentication) {
                if(angular.isDefined(authentication.user) && authentication.user) {
                    return authentication.user;
                } else {
                    return authentication.fetchUserInfo();
                }
            }
        },

        onEnter: function(authentication, $state) {
            // This will redirect to a login step if necessary
            authentication.redirectIfNecessary();
        }
    })

    .state("secured.inbox", messageListOptions("/inbox", {
        data: {
            mailbox: "inbox"
        }
    }))

    .state("secured.inbox.relative", {
        url: "/{rel:first|last}",
        controller: function($scope, $stateParams) {
            $scope.navigateToMessage(null, $stateParams.rel);
        }
    })

    .state("secured.inbox.message", _.clone(messageViewOptions))

    .state("secured.print", _.extend(_.clone(messageViewOptions), {
        url: "/print/:id",
        onEnter: function($rootScope) { $rootScope.isBlank = true; },
        onExit: function($rootScope) { $rootScope.isBlank = false; },
        views: {
            "main@": {
                controller: "ViewMessageController",
                templateUrl: "templates/views/message.print.tpl.html"
            }
        }
    }))

    .state("secured.raw", _.extend(_.clone(messageViewOptions), {
        url: "/raw/:id",
        onEnter: function($rootScope) { $rootScope.isBlank = true; },
        onExit: function($rootScope) { $rootScope.isBlank = false; },
        views: {
            "main@": {
                controller: "ViewMessageController",
                templateUrl: "templates/views/message.raw.tpl.html"
            }
        }
    }))

    .state("secured.contacts", {
        url: "/contacts",
        onEnter: function($rootScope) {
            $rootScope.isInContact = true;
        },
        onExit: function($rootScope) {
            $rootScope.isInContact = false;
        },
        views: {
            "content@secured": {
                templateUrl: "templates/views/contacts.tpl.html",
                controller: "ContactsController"
            }
        },
        resolve: {
            contacts: function(Contact, networkActivityTracker) {
                return networkActivityTracker.track(
                    Contact.get().$promise
                );
            }
        }
    })

    .state("secured.settings", {
        url: "/settings",
        onEnter: function($rootScope) {
            $rootScope.isInMailbox = true;
        },
        onExit: function($rootScope) {
            $rootScope.isInMailbox = false;
        },
        views: {
            "content@secured": {
                templateUrl: "templates/views/settings.tpl.html",
                controller: "SettingsController"
            }
        }
    })

    .state("secured.labels", {
        url: "/labels",
        views: {
            "content@secured": {
                templateUrl: "templates/views/labels.tpl.html",
                controller: "SettingsController"
            }
        }
    })

    .state("secured.security", {
        url: "/security",
        views: {
            "content@secured": {
                templateUrl: "templates/views/security.tpl.html",
                controller: "SettingsController"
            }
        }
    })

    .state("secured.theme", {
        url: "/theme",
        views: {
            "content@secured": {
                templateUrl: "templates/views/theme.tpl.html",
                controller: "SettingsController"
            }
        }
    })

    // -------------------------------------------
    //  ADMIN ROUTES
    // -------------------------------------------

    .state("admin", {
        url: "/admin",
        views: {
            "main@": {
                controller: "AdminController",
                templateUrl: "templates/layout/admin.tpl.html"
            },
            "content@admin": {
                templateUrl: "templates/views/admin.tpl.html"
            }
        }
    })

    .state("admin.invite", {
        url: "/invite",
        views: {
            "content@admin": {
                templateUrl: "templates/views/admin.invite.tpl.html",
                controller: "AdminController"
            }
        }
    })

    .state("admin.monitor", {
        url: "/monitor",
        views: {
            "content@admin": {
                templateUrl: "templates/views/admin.monitor.tpl.html",
                controller: "AdminController"
            }
        }
    })

    .state("admin.logs", {
        url: "/logs",
        views: {
            "content@admin": {
                templateUrl: "templates/views/admin.logs.tpl.html",
                controller: "AdminController"
            }
        }
    });

    _.each(CONSTANTS.MAILBOX_IDENTIFIERS, function(id_, box) {
        if (box === 'inbox') {
            return;
        }

        var stateName = "secured." + box;
        $stateProvider.state(stateName, messageListOptions("/" + box, {
            data: {
                mailbox: box
            }
        }));

        $stateProvider.state("secured." + box + ".message", _.clone(messageViewOptions));
    });

    $urlRouterProvider.otherwise(function($injector) {
        var $state = $injector.get("$state");
        var stateName = $injector.get("authentication").state() || "secured.inbox";
        return $state.href(stateName);
    });

    $locationProvider.html5Mode(true);
})

.run(function($rootScope, $state) {
    $rootScope.go = _.bind($state.go, $state);
});
