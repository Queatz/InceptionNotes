
# Sample note:

{  
  "id":"ngj13m87r4iuma0nj350zs",
  "_sync": {
    "name": { time: <timestamp> },
    "color": { time: <timestamp>, synchronized: true },
    "items": { time: <timestamp>, synchronized: true },
  },
  "_history": {
    changes: [{...}]
  },
  "name":"The Very Top",
  "color":"darkgrey",
  "items":[  
    "mpu78qwimmhfs31ete4dk",
    "qzoeioa2pec9tk0osn4gyt"
  ]
}

# How syncing works:

 1) Always pull and then push
 2) Client-side conflict resolution

Upon established connection between nodes, sync happens.

Pull:

  1) All notes are pulled
  2) Each note is handed to CollaborativeJson for merging

Push:

  1) All notes are scanned for modified items
  2) All notes are marked as synced
  3) Modified items are sent to the other node

Technology:

  Note changes are timestamped in UTC via the js library "moment".

# How CollaborativeJson works:

  let collaborateJson = new CollaborativeJson('_sync');
  collaborateJson.addRule('name', new CollaborativeJsonString());
  collaborateJson.addRule('description', new CollaborativeJsonString());
  collaborateJson.addRule('color', new CollaborativeJsonAtom());
  collaborateJson.addRule('backgroundUrl', new CollaborativeJsonAtom());
  collaborateJson.addRule('items', new CollaborativeJsonArray());
  
  collaborateJson.sync(note, otherNote);
  
  
