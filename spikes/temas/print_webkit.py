import os, sys, gi
gi.require_version("Gtk","3.0"); gi.require_version("WebKit2","4.1")
from gi.repository import Gtk, GLib, WebKit2
here=os.path.dirname(os.path.abspath(__file__)); out=sys.argv[1]
win=Gtk.Window(); view=WebKit2.WebView(); win.add(view); win.show_all()
def loaded(v,ev):
    if ev!=WebKit2.LoadEvent.FINISHED: return
    po=WebKit2.PrintOperation.new(v); ps=Gtk.PrintSettings(); ps.set_printer("Print to File")
    ps.set(Gtk.PRINT_SETTINGS_OUTPUT_URI,"file://"+out); ps.set(Gtk.PRINT_SETTINGS_OUTPUT_FILE_FORMAT,"pdf")
    po.set_print_settings(ps); po.connect("finished",lambda *a:Gtk.main_quit()); po.connect("failed",lambda *a:(print("FAILED"),Gtk.main_quit()))
    po.print_()
view.connect("load-changed",loaded); view.load_uri("file://"+here+"/print.html")
GLib.timeout_add(20000,lambda:(print("timeout"),Gtk.main_quit()))
Gtk.main()
