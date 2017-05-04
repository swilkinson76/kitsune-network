from google.appengine.ext import ndb

class Pin(ndb.Model):
    #use entity key for acticvation
    created_datetime = ndb.DateTimeProperty(auto_now_add=True,indexed=True,required=True)
    email = ndb.StringProperty(required=True)
    user_ip_address = ndb.StringProperty(required=True)
    access_uuid = ndb.StringProperty(required=True)
    is_activated = ndb.BooleanProperty(required=True,indexed=True,default=False)
    point = ndb.GeoPtProperty(required=True)

    name = ndb.StringProperty(required=True)
    about_you = ndb.TextProperty(required=True)
    pin_icon = ndb.IntegerProperty(required=True)
    favorite_member = ndb.IntegerProperty(required=True)
    favorite_song = ndb.IntegerProperty(required=True)
    communities = ndb.StringProperty(required=True)

    def set_pin_values(self, request_values, remote_addr, is_new_pin):
        self.name = request_values.get('name').strip()
        self.about_you = request_values.get('about_you').strip()
        self.pin_icon = int(request_values.get('pin_icon'))
        self.favorite_member = int(request_values.get('favorite_member'))
        self.favorite_song = int(request_values.get('favorite_song'))
        self.communities = request_values.get('communities')
        self.user_ip_address = remote_addr
        if is_new_pin:
            self.access_uuid = base64.urlsafe_b64encode(uuid.uuid4().bytes).replace('=', '')
            self.email = request_values.get('email').strip()
            latitude = request_values.get('latitude')
            longitude = request_values.get('longitude')
            self.point = ndb.GeoPt(latitude, longitude)
        else:
            self.access_uuid = ""
        self.put()

    @classmethod
    def activate_pin(activate_pin_uuid):
        ''' Activate a pin, returns if the activation was a success '''
        pin = Pin.query(Pin.access_uuid == activate_pin_uuid).get()
        if not pin:
            return False
        pin.is_activated = True
        pin.access_uuid = ""
        pin.put()
        send_discord_web_hook(pin)
        # task = taskqueue.add(
        #     url = '/update_pins_json',
        #     target = 'worker',
        #     params = { 'pin_id': pin.key.id() })
        return True

    @classmethod
    def get_edit_pin(edit_pin_uuid):
        pin = Pin.query(Pin.access_uuid == edit_pin_uuid).get()
        return pin
