#!/usr/bin/env python
import logging

import webapp2
import os
import jinja2
import json
import httplib2
import urllib
import base64
import uuid

from kitsunemap_entities import Pin
from ManagePinHandler import ManagePinHandler
import const_data
import credentials

import cloudstorage as gcs
from google.appengine.api import app_identity
from google.appengine.api import taskqueue

JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

class MainHandler(webapp2.RequestHandler):
    def get(self):
        template_values = {}
        show_modal_onload = False
        activate_pin_uuid = self.request.GET.get('activatePin')
        if activate_pin_uuid != None and Pin.activate_pin(activate_pin_uuid):
            show_modal_onload = True
            template_values["show_pin_activated_message"] = True
        edit_pin_uuid = self.request.GET.get('editPin')
        if edit_pin_uuid != None:
            edit_pin = Pin.get_edit_pin(edit_pin_uuid)
            if edit_pin != None:
                show_modal_onload = True
                template_values["edit_pin_uuid"] = edit_pin_uuid
                template_values["pin"] = edit_pin
                template_values["pin_communities"] = [int(x) for x in edit_pin.communities.split(',')]
                add_const_data(template_values)
                template_values["show_pin_edit_form"] = True
        template_values["show_modal_onload"] = show_modal_onload
        template = JINJA_ENVIRONMENT.get_template('templates/map.html')
        self.response.write(template.render(template_values))

def add_const_data(template_values):
    template_values["songs_dict"] = const_data.songs
    template_values["songs_display_sort"] = const_data.songs_display_sort
    template_values["members_dict"] = const_data.members
    template_values["members_display_sort"] = const_data.members_display_sort
    template_values["communities_dict"] = const_data.communities
    template_values["communities_display_sort"] = const_data.communities_display_sort

def send_discord_web_hook(pin):
    pin_details = 'Title: ' + pin.name
    pin_details += '\nFav Song: ' + const_data.songs[str(pin.favorite_song)]
    pin_details += '\nFav Member: ' + const_data.members[str(pin.favorite_member)]
    pin_details += '\nCommunities: ' + ', '.join([const_data.communities[str(community)] for community in pin.communities.split(',')])
    pin_details += '\nAbout: \n' + pin.about_you
    content = """**New Pin Activated!**```%s```""" % pin_details
    task = taskqueue.add(
        url = '/tasks/send_discord_web_hook',
        params = { 'message': content })

class PinsHandler(webapp2.RequestHandler):
    def get(self):
        # bucket_name = os.environ.get('BUCKET_NAME', app_identity.get_default_gcs_bucket_name())
        # with gcs.open('/' + bucket_name + '/pins.json') as cloudstorage_file:
        #     pins = cloudstorage_file.read()
        pins_dict = []
        for pin in Pin.query(Pin.is_activated == True).fetch():
            pin_dict = {}
            pin_dict["id"] = pin.key.id()
            pin_dict["icon"] = pin.pin_icon
            pin_dict["lat"] = pin.point.lat
            pin_dict["lng"] = pin.point.lon
            pins_dict.append(pin_dict)
        self.response.out.write(json.dumps(pins_dict))

class NewPinFormHandler(webapp2.RequestHandler):
    def get(self):
        template_values = {}
        add_const_data(template_values)
        template = JINJA_ENVIRONMENT.get_template('templates/pin/new_pin_form.html')
        self.response.write(template.render(template_values))

class PinInfoHandler(webapp2.RequestHandler):
    def get(self, pin_id):
        pin = Pin.get_by_id(int(pin_id))
        if pin == None:
            self.response.set_status(404)
            self.response.out.write("")
            return
        communities = pin.communities.split(',')
        if len(communities) > 1:
            communities.remove('0')
        template_values = {
            'pin': pin,
            'fav_song': const_data.songs[str(pin.favorite_song)],
            'fav_member': const_data.members[str(pin.favorite_member)],
            'communities': [const_data.communities[community] for community in communities],
        }
        template = JINJA_ENVIRONMENT.get_template('templates/pin_info_window.html')
        self.response.write(template.render(template_values))

class PinEditRequestHandler(webapp2.RequestHandler):
    def post(self):
        email = self.request.POST.get('email')
        edit_pin = Pin.query(Pin.email == email).get()
        if edit_pin and edit_pin.is_activated:
            edit_pin.access_uuid = base64.urlsafe_b64encode(uuid.uuid4().bytes).replace('=', '')
            edit_pin.put()
            send_edit_email(edit_pin.email, edit_pin.access_uuid)
        template_values = { 'action': 'edit' }
        template = JINJA_ENVIRONMENT.get_template('templates/email_sent.html')
        self.response.write(template.render(template_values))

def send_edit_email(recipient, access_uuid):
    http = httplib2.Http()
    http.add_credentials('api', credentials.MAILGUN_API_KEY)

    edit_url = "https://kitsune.network/?editPin=%s" % access_uuid
    html_message = """
        <a href="%s">Click here to edit your pin.</a>
        <p />
        Or copy and paste this URL into your browser:
        <br />
        %s
    """ % (edit_url, edit_url)

    domain = 'kitsune.network'
    url = 'https://api.mailgun.net/v3/%s/messages' % domain
    data = {
        'from': 'Kitsune Network <no-reply@%s>' % domain,
        'to': recipient,
        'subject': 'Edit your pin',
        'text': 'Edit your pin by going to the following url: %s' % edit_url,
        'html': html_message
    }

    resp, content = http.request(
        url, 'POST', urllib.urlencode(data),
        headers={"Content-Type": "application/x-www-form-urlencoded"})

    if resp.status != 200:
        raise RuntimeError(
            'Mailgun API error: {} {}'.format(resp.status, content))

app = webapp2.WSGIApplication([
    ('/', MainHandler),
    ('/pin', ManagePinHandler),
    ('/pin/editRequest', PinEditRequestHandler),
    ('/pin/(.*)', PinInfoHandler),
    ('/pins', PinsHandler),
    ('/new_pin_form.html', NewPinFormHandler),
], debug=True)
