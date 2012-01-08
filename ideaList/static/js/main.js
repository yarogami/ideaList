////////////////////////////////////////////////////
// The JS code for ideaList's main view
////////////////////////////////////////////////////


///////////// GENERAL HELPER FUNCTIONS /////////////

function array_diff(a, b) {
  return a.filter(function(i) {return b.indexOf(i) < 0;});
};
function array_intersect(a, b) {
  return a.filter(function(i) {return b.indexOf(i) >= 0;});
};

function debug(str) {
  if(init_done) {
    console.debug(str);
  } else {
    var item = $('<div>'+str+'<br /></div>')
    $("#debug").append(item);
    item.delay(10000).hide(2000, function(){item.remove()});
  }
}

///////////// GENERAL DOM MANIPULATION /////////////

// Make the main view correspond to newstate
function mergeState(newstate) {
  if (!newstate) {
    debug('Tried to merge null/undefined state');
    return false;
  }
  var old_sub_ids = Object.keys(state.subscriptions);
  var new_sub_ids = Object.keys(newstate.subscriptions);
  var subs_to_add = array_diff(new_sub_ids, old_sub_ids);
  var subs_to_remove = array_diff(old_sub_ids, new_sub_ids);
  var subs_to_update = array_intersect(old_sub_ids, new_sub_ids);
  debug("Subs to add/remove/update: "
    +"("+subs_to_add+")/("+subs_to_remove+")/("+subs_to_update+")");

  for(var i in subs_to_add)
    addSubscription(newstate.subscriptions[subs_to_add[i]], init_done);
  for(var i in subs_to_remove)
    removeSubscription(newstate.subscriptions[subs_to_remove[i]], true);
  for(var i in subs_to_update)
    updateSubscription(newstate.subscriptions[subs_to_update[i]]);
}

function parseErrorThrown(errorThrown) {
  try {
    var data = $.parseJSON(errorThrown);
  } catch(e) {
    debug("Couldn't parse errorThrown: "+e);
    return null;
  }
  return data;
}


///////////// SUBSCRIPTION RELATED DOM MANIPULATION /////////////

function initAddItemField(field) {
  return field.blur(function() {
    if($(this).val() == "") {
      $(this).val(newitemText)
        .addClass("newitem_blur");
    }
  }).focus(function() {
    $(this).removeClass("newitem_blur");
    if($(this).val() == newitemText)
      $(this).val("");
  }).keydown(function(e) {
    if(e.keyCode == 13) {
      var val = $(this).val();
      var addfield = $(this); //For resetting later...
      if (val.length == 0)
        return false;
      var res = /^add_to_(end|begin)_of_list_(\d+)$/.exec($(this).attr('id'));
      if (res.length != 3)
        return false;
      var pos = res[1];
      var list_id = res[2];
      var position = (pos == 'begin' ? 0 : -1);
      $.ajax('/ideaList/additem/', {
        dataType: "json",
        type: "POST",
        data: {list:list_id, text:val, position:position},
      }).done(function(data) {
        addfield.val("").blur(); // Reset additem field
        mergeState(data.state);
      }).fail(function(jqXHR, textStatus, errorThrown) {
        msg = textStatus;
        var data = parseErrorThrown(errorThrown);
        if (data) {
          if (data.msg)
            msg = data.msg;
          if (data.state)
            mergeState(data.state);
        }
        debug("Error in adding item: "+msg);
      });
    }
  }).addClass("newitem_blur");
}
function makeAddItemField(subscr, pos) {
  if (pos == null)
    pos = 'end';
  var addItemHtml =
    $('<input id="add_to_'+pos+'_of_list_'+subscr.list.id+'"'
    +' class="newitem" type="text" value="'+newitemText+'"></input>');
  initAddItemField(addItemHtml);
  return addItemHtml;
}
function makeSubscription(s) {
  var l = s.list;
  var subscriptionHtml = $('<li id="subscription_'+s.id+'" class="list"></li>')
    .append($('<span id="subscription_'+s.id+'_listname" class="list-name">'
          +l.name+'</span>'));
  var itemListHtml = $('<ul class="itemlist"></ul>\n');
  var items = $.map(l.items, function(x) {return x;}).sort(function(a,b) {
    return a.position-b.position;
  });
  for (var i in items) {
    var itemHtml = makeItem(items[i]);
    itemListHtml.append(itemHtml);
  }
  itemListHtml.append($('<li></li>').append(makeAddItemField(s, 'end')));
  subscriptionHtml.append(itemListHtml);
  return subscriptionHtml;
}
function addSubscription(s, animate) {
  debug('Adding subscription '+s.id+' ('+s.list.name+')');
  if ($('#subscription_'+s.id).length != 0) {
    debug('Tried to add subscription '+s.id+', but it already exists');
    return;
  }
  var pos = s.position;
  var cursubs = $.map(state.subscriptions, function(x){return x;});
  var subscriptionHtml = makeSubscription(s);
  if (animate)
    subscriptionHtml.hide().delay(50).show(2000);
  sub_of_list[s.list.id] = s.id;
  if (cursubs.length == 0 || pos == 0) {
    $('#listlist').prepend(subscriptionHtml);
    state.subscriptions[s.id] = s;
  } else {
    for (var i in cursubs) {
      if (cursubs[i].position > pos) {
        $("#subscription_"+cursubs[i].position).before(subscriptionHtml);
        state.subscriptions[s.id] = s;
        return;
      }
    }
    $('#listlist').append(subscriptionHtml);
    state.subscriptions[s.id] = s;
  }
}
function removeSubscription(s, animate) {
  debug('Removing subscription '+s.id+' ('+s.list.name+')');
  // Find list that corresponds to this subscription id
  var sub = $('#subscription_'+s.id);
  if (sub.length == 0)
    debug('Could not remove subscription '+s.id+": not found");
  if (animate)
    $('#subscription_'+s.id).hide(2000, function(){$(this).remove()});
  else
    $('#subscription_'+s.id).remove();
  delete state.subscriptions[s.id];
  delete sub_of_list[s.list.id]
}
function updateSubscription(s) {
  debug('Updating subscription '+s.id+' ('+s.list.name+')');
  var old_sub = state.subscriptions[s.id];
  var old_item_ids = Object.keys(old_sub.list.items);
  var new_item_ids = Object.keys(s.list.items);
  var items_to_remove = array_diff(old_item_ids, new_item_ids);
  var items_to_add = array_diff(new_item_ids, old_item_ids);
  var items_to_update = array_intersect(old_item_ids, new_item_ids);
  debug("Items to add/remove/update: "
    +"("+items_to_add+")/("+items_to_remove+")/("+items_to_update+")");
  for(var i in items_to_add)
    addItem(s.list.items[items_to_add[i]]);
  for(var i in items_to_remove)
    removeItem(old_sub.list.items[items_to_remove[i]], true);
  // Ugly hack until updateItem handles position changes properly:
  var updateItems = $.map(items_to_update, function(i){return s.list.items[i];})
      .sort(function(a,b) {return a.position - b.position;});
  for(var i in updateItems)
    updateItem(updateItems[i], s.id);

  // update list name
  if(old_sub.list.name != s.list.name) {
    $('#subscription_'+s.id+'_listname').html(s.list.name)
    state.subscriptions[s.id].list.name = s.list.name
  }

  //TODO: move subscription to correct_position
  //TODO: update minimized-state when minimization is implemented
}

///////////// ITEM RELATED DOM MANIPULATION /////////////

function makeItem(itemdata) {
  function removeitemHandler(e) {
    e.preventDefault();
    var item_elem = $(this).parent();
    var res = /^remove_item_(\d+)$/.exec($(this).attr('id'));
    if (res.length != 2)
      return false;
    var item_id = res[1];
    $.ajax('/ideaList/removeitem/', {
      dataType: "json",
      type: "POST",
      data: {item_id:item_id},
    }).done(function(data) {
      debug("Item "+item_id+" removed");
      mergeState(data.state);
    }).fail(function(jqXHR, textStatus, errorThrown) {
      debug("Error in remove item: "+textStatus);
      var data = parseErrorThrown(errorThrown);
      if (data && data.state)
        mergeState(data.state);
    });
  }
  function moveitemHandler(e) {
    e.preventDefault();
    var item_elem = $(this).parent();
    var res = /^move_item_(\d+)_(up|down)$/.exec($(this).attr('id'));
    if (res.length != 3)
      return false;
    var item_id = res[1];
    var direction = res[2];
    var item_before = null; // Item before which to insert item_elem
    if (direction == 'up')
      item_before = item_elem.prev();
    else
      item_before = item_elem.next();
    if (item_before.length != 1 || !item_before.hasClass('item'))
      return false;
    $.ajax('/ideaList/moveitem/', {
      dataType: "json",
      type: "POST",
      data: {
        item_id:item_id,
        where:direction,
      },
    }).done(function(data) {
      mergeState(data.state);
    }).fail(function(jqXHR, textStatus, errorThrown) {
      debug("Error in remove item: "+textStatus);
      var data = parseErrorThrown(errorThrown);
      if (data && data.state)
        mergeState(data.state);
    });
  }
  var item_id = itemdata.id;
  var text = itemdata.text;
  var itemTextHtml = $('<span id="item_'+item_id+'_text" class="item-text">'+text+'</span>').editable(editableUrl, editableSettings);;
  var removeHtml = $('<a id="remove_item_'+item_id+'" class="itemaction removeitem" href="#">&#10005;</a>').click(removeitemHandler);
  var moveUpHtml = $('<a id="move_item_'+item_id+'_up" class="itemaction moveitem" href="#">&uarr;</a>').click(moveitemHandler);
  var moveDownHtml = $('<a id="move_item_'+item_id+'_down" class="itemaction moveitem" href="#">&darr;</a>').click(moveitemHandler);
  var itemHtml = $('<li id="item_'+item_id+'" class="item"></li>');
  itemHtml
    .append(itemTextHtml)
    .append('&nbsp;').append(removeHtml)
    .append('&nbsp;').append(moveUpHtml)
    .append('&nbsp;').append(moveDownHtml);
  return itemHtml;
}
function addItem(item, animate) {
  debug('Adding item '+item.id+' ('+item.text+')');
  var list_id = item.list_id;
  sub_id = sub_of_list[item.list_id];
  if (sub_id === undefined) {
    debug('Tried to add an item to a nonexisting list');
    return false;
  }
  if ($('#item_'+item.id).length != 0) {
    debug('Tried to add item '+item.id+', but it already exists');
    return;
  }
  if ($('#subscription_'+sub_id).length == 0) {
    debug('Tried to add item '+item.id+' to a nonexisting subscription');
    return;
  }
  var pos = item.position;
  var curitems = state.subscriptions[sub_id].list.items;
  var itemHtml = makeItem(item)
  if (animate)
    itemHtml.hide().delay(50).show(2000);
  if (Object.keys(curitems).length == 0 || pos == 0) {
    $('#subscription_'+sub_id+' > ul').prepend(itemHtml);
    state.subscriptions[sub_id].list.items[item.id] = item;
  } else {
    for (var i in curitems) {
      //debug('    Checking idx '+i+': '+curitems[i].text);
      if (curitems[i].position > pos) {
        //debug('      Adding before idx '+i);
        $('#item_'+curitems[i].id).before(itemHtml);
        state.subscriptions[sub_id].list.items[item.id] = item;
        return;
      }
    }
    //debug('  Adding item to last position');
    $('#subscription_'+sub_id+' > ul > li.item').last().after(itemHtml);
    state.subscriptions[sub_id].list.items[item.id] = item;
  }
}
function removeItem(item, animate) {
  debug('Removing item '+item.id+' ('+item.text+')');
  if (animate)
    $('#item_'+item.id).hide(1000, function(){$(this).remove()});
  else
    $('#item_'+item.id).remove();
  delete state.subscriptions[sub_of_list[item.list_id]].list.items[item.id];
}
function updateItem(item, sub_id) {
  // TODO: improve
  debug('Updating item '+item.id+' ('+item.text+')');
  removeItem(item);
  addItem(item);
}

///////////// STATUSLIGHT RELATED STUFF /////////////

var pendingAjaxCalls = 0;
function setStatusLight() {
  if (pendingAjaxCalls > 0)
    $('#status-light').attr('class', 'yellow');
  else
    $('#status-light').attr('class', 'green');
}

$(document).ajaxSend(function() {
  pendingAjaxCalls++;
  setStatusLight();
});
$(document).ajaxSuccess(function() {
  pendingAjaxCalls--;
  setStatusLight();
});
$(document).ajaxError(function() {
  pendingAjaxCalls--;
  $('#status-light').attr('class', 'red');
  setTimeout('setStatusLight()', 2000);
});

///////////// INITIALIZATION /////////////

// Django CSRF protection for AJAX calls
$(document).ajaxSend(function(event, xhr, settings) {
  function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var cookie = jQuery.trim(cookies[i]);
        // Does this cookie string begin with the name we want?
        if (cookie.substring(0, name.length + 1) == (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
  function safeMethod(method) {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
  }

  if (!safeMethod(settings.type) && !settings.crossDomain) {
    xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
  }
});

$.ajaxSetup({timeout:3000});

var newitemText = "New item..."

var editableUrl = '/ideaList/edittext/';
var editableSettings = {
    tooltip: "Click to edit",
    style:   "inherit",
    id:      "element_id",
    name:    "text",
  };

var init_done = false;
$(document).ready(function() {
  state = {subscriptions: {}};
  sub_of_list = {};
  mergeState(init_state);
  setStatusLight();
  init_done = true;
});
