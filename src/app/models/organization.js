angular.module("proton.models.organization", [])

.factory("Organization", function($http, $q, url) {
    return {
        // POST
        /**
         * Create a new group of given parameters. Requires a subscription.
         */
        create: function(Obj) {
            return $http.post(url.get() + '/organizations', Obj);
        },
        //GET
        /**
         * Get group info: group name, token IDs, members (ids, names, roles, addresses, used space, space limit), domains (ids, names, verification status for MX, SPF, DKIM), usage and limits (for domains, members, addresses and space), billing info (status, billing cycle, next billing time). Only available for the group admin.
         */
        get: function() {
            return $http.get(url.get() + '/organizations');
        },
        // PUT
        /**
         * Update group in a way that doesn't require a payment (name, billing cycle, tokens).
         */
        update: function(Obj) {
            return $http.put(url.get() + '/organizations', Obj);
        },
        /**
         * Update group in a way that requires a payment.
         */
        payment: function(Obj) {
            return $http.put(url.get() + '/organizations/payment', Obj);
        },
        // DELETE
        /**
         * Delete the group.
         */
        delete: function() {
            return $http.delete(url.get() + '/organizations');
        }
    };
});
