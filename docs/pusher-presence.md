Presence channels
Presence channels build on the security of Private channels and expose the additional feature of an awareness of who is subscribed to that channel. This makes it extremely easy to build chat room and “who’s online” type functionality to your application. Think chat rooms, collaborators on a document, people viewing the same web page, competitors in a game, that kind of thing.

Presence channels are subscribed to from the client API in the same way as private channels but the channel name must be prefixed with presence-. As with private channels a HTTP Request is made to a configurable authorization URL to determine if the current user has permissions to access the channel (see Authorizing Users ).

Each member of the presence channel has a user object containing the id of the user and a user_info field with more information about that user (e.g. name). That user object is shared with other members of the presence channel to identify this user. This user object can come from two places:

If the user is signed in with Pusher by using the signin method on the client, the user object provided during user authentication will be shared with other members in presence channels to identify this user. See more about providing the user object (user_data) in Authenticating Users.
You can always provide the user object during the authorization step of a presence channel which will override the user object coming from User Authentication.
Information on users subscribing to, and unsubscribing from a channel can then be accessed by binding to events on the presence channel and the current state of users subscribed to the channel is available via the channel.members property .

Presence channels must be prefixed with presence- . See channel naming conventions.

Presence channel subscriptions must be authorized. See Authorizing Users.

Presence channels have some limits associated with them: 100 members maximum, 1KB limit for user object, and maximum 128 characters for user id. If you use a numeric user id, remember that the maximum size integer that is representable in JavaScript is 2^53.

∞ Subscribe
When subscribing the user authorization process will be triggered.

JavaScript
Swift
Laravel Echo
var presenceChannel = pusher.subscribe(presenceChannelName);
∞
presenceChannelName
String
Required
The name of the channel to subscribe to. Since it is a presence channel the name must be prefixed with presence-.

∞ Returns
An object which events can be bound to. See binding to events for more information.

∞ Unsubscribe
See unsubscribing from channels.

∞ Accessing channel members
Documentation for accessing channel members is only presently available for the Channels JavaScript library. For other libraries please see the README file.

A Presence channel has a members property. This object represents the state of the users that are subscribed to the presence channel. The members object has the following properties and methods:

∞
members.count
Number
var count = presenceChannel.members.count;
A property with a value that indicates how many members are subscribed to the presence channel.

∞
members.each(function)
Function
presenceChannel.members.each(function (member) {
  var userId = member.id;
  var userInfo = member.info;
});
The members.each function is used to iterate the members who are subscribed to the presence channel. The method takes a single function parameter which is called for each member that is subscribed to the presence channel. The function will be pass a member object representing each subscribed member.

∞
members.get(userId)
Function
var user = presenceChannel.members.get("some_user_id");
The get(userId) method can be used to get a member with a specified userId.

∞ Returns
A member object with a member.id and member.info property.

∞
members.me
Object
var me = presenceChannel.members.me;
Once a user has had their subscription request authorized (see Authorizing Users ) and the subscription has succeeded (see pusher:subscription_succeeded ) it is possible to access information about the local user on the presence channel.

The me property represents a member object and has an id and info property. For more information on the member object see Presence channel events section.

∞ Example
var pusher = new Pusher("app_key");
var presenceChannel = pusher.subscribe("presence-example");
presenceChannel.bind("pusher:subscription_succeeded", function () {
  var me = presenceChannel.members.me;
  var userId = me.id;
  var userInfo = me.info;
});
∞ Events
Documentation for Presence events is only presently available for the Channels JavaScript library. For other libraries please see the README file.

See binding to events for general information about how to bind to events on a channel object.

After a subscripting to a presence channel you can subscribe to presence events on that channel. Presence channels have a number of pre-defined events that can be bound to in order to notify a connected client about users joining or leaving the channel.

∞
pusher:subscription_succeeded
Function
Once a subscription has been made to a presence channel, an event is triggered with a members iterator. You could use this for example to build a user list.

∞ Example
JavaScript
Laravel Echo
var channel = pusher.subscribe("presence-meeting-11");
channel.bind("pusher:subscription_succeeded", (members) => {
  // For example
  update_member_count(members.count);

  members.each((member) => {
    // For example
    add_member(member.id, member.info);
  });
});
∞ The members parameter
When the pusher:subscription_succeeded event is triggered a members parameter is passed to the callback. The parameter is the channel.members property .

∞
pusher:subscription_error
Function
For more information on the pusher:subscription_error event please see the subscription error section of the client event docs.

∞
pusher:member_added
Function
The pusher:member_added event is triggered when a user joins a channel. It’s quite possible that a user can have multiple connections to the same channel (for example by having multiple browser tabs open) and in this case the events will only be triggered when the first tab is opened.

∞ Example
JavaScript
Laravel Echo
channel.bind("pusher:member_added", (member) => {
  // For example
  add_member(member.id, member.info);
});
When the event is triggered and member object is passed to the callback. The member object has the following properties:

id (String)
A unique identifier of the user. The value for this depends on the server authentication.
info (Object)
An object that can have any number of properties on it. The properties depend on the server authentication.
∞
pusher:member_removed
Function
The pusher:member_removed is triggered when a user leaves a channel. It’s quite possible that a user can have multiple connections to the same channel (for example by having multiple browser tabs open) and in this case the events will only be triggered when the last one is closed.

∞ Example
JavaScript
Laravel Echo
channel.bind("pusher:member_removed", (member) => {
  // For example
  remove_member(member.id, member.info);
});
id (String)
A unique identifier of the user. The value for this depends on the server authentication.
info (Object)
An object that can have any number of properties on it. The properties depend on the server authentication.
∞ user_id in client events
When you bind to client events on presence channels, your bound callback will be called with a metadata object which contains a user_id key. See the client events docs for more detail.

∞ Subscription counting
Presence channels provide information about members, including the number of members. However, it is currently limited to channels with less than 100 members.

If you are interested in knowing the total number of members in large channels, and do not need to know who has joined or left, you can use the subscription counting event feature instead of using a Presence channel.